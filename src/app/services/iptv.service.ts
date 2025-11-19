import { Injectable, signal, computed, inject, WritableSignal } from '@angular/core';
import { Channel, Playlist, Category, VODItem, Episode, Season, VODCategory, WatchHistory, PaginatedResponse } from '../models/iptv.models';
import { NotificationService } from './notification.service';
import { SettingsService } from './settings.service';
import { TauriService } from './tauri.service';

export type SortOrder = 'default' | 'asc' | 'desc';

export type VODFilter = 
  | { type: 'all' }
  | { type: 'watchlist' }
  | { type: 'favorites' }
  | { type: 'continue-watching' }
  | { type: 'history' }
  | { type: 'category'; categoryName: string };

export interface FetchOptions {
    page: number;
    pageSize: number;
    searchTerm: string;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
    filter: any; 
    showHidden?: boolean;
}

function updateItemInPaginatedSignal<T extends { id: number }>(
  signal: WritableSignal<PaginatedResponse<T>>,
  updatedItem: T
) {
  signal.update(current => ({
    ...current,
    items: current.items.map(item => item.id === updatedItem.id ? updatedItem : item)
  }));
}

// Helper to remove an item from a list (e.g. removing from favorites view)
function removeItemFromPaginatedSignal<T extends { id: number }>(
  signal: WritableSignal<PaginatedResponse<T>>,
  id: number
) {
  signal.update(current => ({
    ...current,
    items: current.items.filter(item => item.id !== id),
    total: Math.max(0, current.total - 1)
  }));
}

@Injectable({
  providedIn: 'root'
})
export class IptvService {
  private lastFetchOptions: Partial<FetchOptions> = {};
  private notificationService = inject(NotificationService);
  private settingsService = inject(SettingsService);
  private tauriService = inject(TauriService);
  private currentRequestId = 0;

  // --- STATE SIGNALS ---
  readonly isInitializing = signal(true);
  readonly initialRefreshComplete = signal(false);
  private isFirstRefresh = true;

  readonly playlists = signal<Playlist[]>([]);
  readonly categories = signal<Category[]>([]);
  
  readonly watchHistory = signal<Record<string, WatchHistory>>({});
  readonly now = signal(new Date());

  // --- SEPARATED DATA SIGNALS ---
  // 1. Live TV List
  readonly channels = signal<PaginatedResponse<Channel>>({ items: [], hasMore: false, total: 0 });
  // 2. Favorites List
  readonly favoriteChannels = signal<PaginatedResponse<Channel>>({ items: [], hasMore: false, total: 0 });
  // 3. Recently Watched List
  readonly recentChannels = signal<PaginatedResponse<Channel>>({ items: [], hasMore: false, total: 0 });

  readonly channelsLoading = signal(false);
  readonly channelsError = signal<string | null>(null);

  readonly movies = signal<PaginatedResponse<VODItem>>({ items: [], hasMore: false, total: 0 });
  readonly moviesLoading = signal(false);
  readonly moviesError = signal<string | null>(null);
  
  readonly series = signal<PaginatedResponse<VODItem>>({ items: [], hasMore: false, total: 0 });
  readonly seriesLoading = signal(false);
  readonly seriesError = signal<string | null>(null);

  readonly selectedSeriesSeasons = signal<Season[]>([]);
  readonly seasonsLoading = signal(false);

  // Selection & Filter states
  readonly selectedChannel = signal<Channel | null>(null);
  readonly selectedVODItem = signal<VODItem | null>(null);
  readonly selectedEpisode = signal<Episode | null>(null);
  readonly selectedPlaylistForDetails = signal<Playlist | null>(null);
  readonly selectedSeries = signal<VODItem | null>(null);
  readonly selectedSeason = signal<Season | null>(null);
  readonly selectedCategoryId = signal<number | null>(null);
  readonly selectedVODFilter = signal<VODFilter>({ type: 'all' });
  
  readonly searchTerm = signal('');
  readonly showHiddenCategories = signal(false);
  readonly showHiddenChannels = signal(false);
  readonly categorySortOrder = signal<SortOrder>('default');
  readonly channelSortOrder = signal<SortOrder>('default');
  readonly movieSortOrder = signal<SortOrder>('default');
  readonly seriesSortOrder = signal<SortOrder>('default');

  // --- COMPUTED SIGNALS ---
  readonly hasPlaylists = computed(() => (this.playlists() || []).length > 0);
  readonly activePlaylists = computed(() => (this.playlists() || []).filter(p => p.isActive));
  readonly playlistsInError = computed(() => (this.playlists() || []).filter(p => p.status === 'error'));
  readonly playlistsLoading = computed(() => (this.playlists() || []).filter(p => p.status === 'loading'));

  readonly categoriesForActivePlaylist = computed(() => {
    const activePls = this.activePlaylists();
    if (activePls.length === 0) return [];
    const activePlaylistIds = new Set(activePls.map(p => p.id));
    
    let categories = this.categories().filter(c => activePlaylistIds.has(c.playlistId));

    if (this.showHiddenCategories()) {
        categories = categories.filter(c => c.isHidden);
    } else {
        categories = categories.filter(c => !c.isHidden);
    }
    
    const order = this.categorySortOrder();
    if (order === 'asc') {
      categories = [...categories].sort((a, b) => a.name.localeCompare(b.name));
    } else if (order === 'desc') {
      categories = [...categories].sort((a, b) => b.name.localeCompare(a.name));
    }
    return categories;
  });

  readonly movieCategories = computed<VODCategory[]>(() => []);
  readonly seriesCategories = computed<VODCategory[]>(() => []);

  constructor() {
    this._listenForBackendEvents();
    setInterval(() => this.now.set(new Date()), 30000);
  }

  private _getErrorMessage(error: unknown): string {
    if (typeof error === 'string') return error;
    if (error instanceof Error) return error.message;
    if (error && typeof error === 'object' && 'message' in error && typeof (error as { message: unknown }).message === 'string') {
      return (error as { message: string }).message;
    }
    return 'An unknown error occurred.';
  }

  private _listenForBackendEvents(): void {
    this.tauriService.listen<Playlist>('playlist-update', (event) => {
      const updatedPlaylist = event.payload;
      this.playlists.update(current =>
        current.map(p => p.id === updatedPlaylist.id ? updatedPlaylist : p)
      );
    });

    this.tauriService.listen<void>('refresh-complete', async () => {
      console.log('Backend signaled playlist refresh is complete. Triggering EPG refresh...');
      this.tauriService.invoke('refresh_epg');
      await this.fetchCategories();
      if (this.isFirstRefresh) {
        this.isFirstRefresh = false;
        this.initialRefreshComplete.set(true);
        this.isInitializing.set(false);
      }
    });

    this.tauriService.listen<void>('epg-complete', () => {
      console.log('EPG Refresh complete. Reloading current view...');
      if (this.lastFetchOptions && Object.keys(this.lastFetchOptions).length > 0) {
          this.fetchChannels(this.lastFetchOptions, false);
      }
    });
  }
  
  async init() {
    this.isInitializing.set(true);
    try {
        await this.tauriService.invoke('initialize_database');
        await this.settingsService.loadSettings();
        const playlists = await this.tauriService.invoke<Playlist[]>('get_playlists');
        this.playlists.set(playlists);
        if (this.activePlaylists().length > 0) {
            this.tauriService.invoke('refresh_all_playlists');
        } else {
            this.isFirstRefresh = false;
            this.initialRefreshComplete.set(true);
            this.isInitializing.set(false);
        }
    } catch (error) {
        console.error("Initialization failed:", error);
        this.notificationService.show(`Failed to load initial data: ${this._getErrorMessage(error)}`, 'error');
        this.isInitializing.set(false);
    }
  }

  // --- DATA FETCHING METHODS ---
  async fetchChannels(options: Partial<FetchOptions>, loadMore = false) {
    this.lastFetchOptions = options;
    const requestId = ++this.currentRequestId;
    
    this.channelsLoading.set(true);
    this.channelsError.set(null);
    
    try {
        const result = await this.tauriService.invoke<PaginatedResponse<Channel>>('get_channels', { options });
        
        if (this.currentRequestId === requestId) {
            // --- NEW LOGIC: Target specific signals based on filter ---
            let targetSignal: WritableSignal<PaginatedResponse<Channel>>;
            
            if (options.filter?.type === 'favorites') {
                targetSignal = this.favoriteChannels;
            } else if (options.filter?.type === 'recently-watched') {
                targetSignal = this.recentChannels;
            } else {
                targetSignal = this.channels;
            }

            if (loadMore) {
                targetSignal.update(current => ({
                    ...result,
                    items: [...current.items, ...result.items]
                }));
            } else {
                targetSignal.set(result);
            }
        }
    } catch(err) {
        if (this.currentRequestId === requestId) {
            console.error("Failed to fetch channels:", err);
            const errorMessage = this._getErrorMessage(err);
            this.channelsError.set(errorMessage);
            this.notificationService.show(`Error fetching channels: ${errorMessage}`, 'error');
        }
    } finally {
        if (this.currentRequestId === requestId) {
            this.channelsLoading.set(false);
        }
    }
  }
  
  async fetchMovies(options: Partial<FetchOptions>, loadMore = false) {
    this.moviesLoading.set(true);
    this.moviesError.set(null);
    try {
        const result = await this.tauriService.invoke<PaginatedResponse<VODItem>>('get_movies', { _options: options });
        if (loadMore) {
            this.movies.update(current => ({ ...result, items: [...current.items, ...result.items] }));
        } else {
            this.movies.set(result);
        }
    } catch(err) {
        console.error("Failed to fetch movies:", err);
        const errorMessage = this._getErrorMessage(err);
        this.moviesError.set(errorMessage);
        this.notificationService.show(`Error fetching movies: ${errorMessage}`, 'error');
    } finally {
        this.moviesLoading.set(false);
    }
  }
  
  async fetchSeries(options: Partial<FetchOptions>, loadMore = false) {
    this.seriesLoading.set(true);
    this.seriesError.set(null);
    try {
        const result = await this.tauriService.invoke<PaginatedResponse<VODItem>>('get_series', { _options: options });
        if (loadMore) {
            this.series.update(current => ({ ...result, items: [...current.items, ...result.items] }));
        } else {
            this.series.set(result);
        }
    } catch(err) {
        console.error("Failed to fetch series:", err);
        const errorMessage = this._getErrorMessage(err);
        this.seriesError.set(errorMessage);
        this.notificationService.show(`Error fetching series: ${errorMessage}`, 'error');
    } finally {
        this.seriesLoading.set(false);
    }
  }

  async fetchSeasonsForSeries(seriesId: number) {
    this.seasonsLoading.set(true);
    try {
        const seasons = await this.tauriService.invoke<Season[]>('get_seasons_for_series', { _series_id: seriesId });
        this.selectedSeriesSeasons.set(seasons);
    } catch (err) {
        console.error("Failed to fetch seasons:", err);
        this.notificationService.show(`Error fetching seasons: ${this._getErrorMessage(err)}`, 'error');
        this.selectedSeriesSeasons.set([]);
    } finally {
        this.seasonsLoading.set(false);
    }
  }

  async fetchCategories() {
    try {
        const categories = await this.tauriService.invoke<Category[]>('get_categories');
        this.categories.set(categories);
    } catch (err) {
        console.error("Failed to fetch categories:", err);
        this.notificationService.show(`Error fetching categories: ${this._getErrorMessage(err)}`, 'error');
    }
  }

  // --- SELECTION & MUTATION METHODS ---
  selectChannel(channel: Channel | null) { this.selectedChannel.set(channel); this.selectedVODItem.set(null); this.selectedEpisode.set(null); }
  selectVODItem(item: VODItem | null) { this.selectedVODItem.set(item); this.selectedChannel.set(null); this.selectedEpisode.set(null); }
  selectEpisode(episode: Episode | null) { this.selectedEpisode.set(episode); this.selectedChannel.set(null); this.selectedVODItem.set(null); }
  selectPlaylistForDetails(playlist: Playlist | null) { this.selectedPlaylistForDetails.set(playlist); }
  selectSeason(season: Season | null) { this.selectedSeason.set(season); }
  selectVODFilter(filter: VODFilter) { this.selectedVODFilter.set(filter); }
  
  selectSeries(series: VODItem | null) {
    this.selectedSeries.set(series);
    if (series) {
      this.fetchSeasonsForSeries(series.id);
      this.selectVODItem(series);
    } else {
      this.selectedSeriesSeasons.set([]);
      this.selectedSeason.set(null);
      this.selectVODItem(null);
    }
  }

  async addPlaylist(newPlaylistData: Omit<Playlist, 'id' | 'isActive' | 'status'>) {
    try {
      const newPlaylist = await this.tauriService.invoke<Playlist>('add_playlist', { playlist_data: newPlaylistData });
      this.playlists.update(p => [...p, newPlaylist]);
      this.notificationService.show('Playlist added!', 'success');
      this.refreshPlaylist(newPlaylist.id);
    } catch (err) {
      console.error("Failed to add playlist:", err);
      this.notificationService.show(`Error adding playlist: ${this._getErrorMessage(err)}`, 'error');
    }
  }

  async updatePlaylist(playlist: Playlist) {
    try {
      const updatedPlaylist = await this.tauriService.invoke<Playlist>('update_playlist', { playlist });
      this.playlists.update(p => p.map(pl => pl.id === updatedPlaylist.id ? updatedPlaylist : pl));
      this.notificationService.show('Playlist updated!', 'success');
    } catch (err) {
      console.error("Failed to update playlist:", err);
      this.notificationService.show(`Error updating playlist: ${this._getErrorMessage(err)}`, 'error');
    }
  }

  async deletePlaylist(id: number) {
    try {
      await this.tauriService.invoke('delete_playlist', { id });
      this.playlists.update(p => p.filter(pl => pl.id !== id));
      this.notificationService.show('Playlist deleted.', 'success');
    } catch (err) {
      console.error("Failed to delete playlist:", err);
      this.notificationService.show(`Error deleting playlist: ${this._getErrorMessage(err)}`, 'error');
    }
  }

  async togglePlaylistActive(id: number) {
    const playlist = this.playlists().find(p => p.id === id);
    if (!playlist) return;
    try {
        const updatedPlaylist = await this.tauriService.invoke<Playlist>('update_playlist_active_status', { id, is_active: !playlist.isActive });
        this.playlists.update(p => p.map(pl => pl.id === id ? updatedPlaylist : pl));
    } catch (err) {
        console.error("Failed to toggle playlist active status:", err);
        this.notificationService.show(`Error updating playlist status: ${this._getErrorMessage(err)}`, 'error');
    }
  }

  async refreshPlaylist(id: number) { 
    this.notificationService.show('Refreshing playlist...', 'info'); 
    try {
        await this.tauriService.invoke('refresh_playlist', { playlist_id: id });
    } catch (err) {
        console.error("Failed to start refresh:", err);
        this.notificationService.show(`Error starting refresh: ${this._getErrorMessage(err)}`, 'error');
    }
  }
  
  async refreshAllPlaylists(showNotification = true) { 
    if (showNotification) this.notificationService.show('Refreshing all playlists...', 'info'); 
    try {
        await this.tauriService.invoke('refresh_all_playlists');
    } catch (err) {
        console.error("Failed to start all refresh:", err);
        this.notificationService.show(`Error starting refresh: ${this._getErrorMessage(err)}`, 'error');
    }
  }

  selectCategory(id: number | null) { this.selectedCategoryId.set(id); }
  toggleShowHiddenCategories() { this.showHiddenCategories.update(v => !v); }
  toggleShowHiddenChannels() { this.showHiddenChannels.update(v => !v); }
  
  async toggleCategoryVisibility(id: number) {
    try {
      const updatedCategory = await this.tauriService.invoke<Category>('toggle_category_visibility', { id });
      this.categories.update(cats => cats.map(c => c.id === id ? updatedCategory : c));
      this.notificationService.show(`Category "${updatedCategory.name}" is now ${updatedCategory.isHidden ? 'hidden' : 'visible'}.`, 'info');
    } catch (err) {
      console.error("Failed to toggle category visibility:", err);
      this.notificationService.show(`Error updating category visibility: ${this._getErrorMessage(err)}`, 'error');
    }
  }

  setCategorySortOrder(order: SortOrder) { this.categorySortOrder.set(order); }
  
  async batchSetCategoryVisibility(ids: number[], isHidden: boolean) {
    if (ids.length === 0) return;
    try {
      await this.tauriService.invoke('batch_update_category_visibility', { ids, isHidden: isHidden });
      const idSet = new Set(ids);
      this.categories.update(cats => cats.map(c => idSet.has(c.id) ? { ...c, isHidden } : c));
      this.notificationService.show(`${ids.length} categories have been ${isHidden ? 'hidden' : 'made visible'}.`, 'success');
    } catch (err) {
      console.error("Failed to batch update category visibility:", err);
      this.notificationService.show(`Error updating categories: ${this._getErrorMessage(err)}`, 'error');
    }
  }
  
  setSearchTerm(term: string) { this.searchTerm.set(term); }
  
  async toggleFavorite(id: number) {
    const selected = this.selectedChannel();
    // Try to find channel in any of the lists
    const channel = this.channels().items.find(c => c.id === id) 
                 ?? this.favoriteChannels().items.find(c => c.id === id)
                 ?? this.recentChannels().items.find(c => c.id === id)
                 ?? (selected?.id === id ? selected : undefined);
    
    if (!channel) return;

    const originalState = { ...channel };
    const optimisticState = { ...channel, isFavorite: !channel.isFavorite };

    // Optimistically update ALL lists to keep them in sync
    updateItemInPaginatedSignal(this.channels, optimisticState);
    updateItemInPaginatedSignal(this.favoriteChannels, optimisticState);
    updateItemInPaginatedSignal(this.recentChannels, optimisticState);
    
    if (selected?.id === id) this.selectedChannel.set(optimisticState);
    
    try {
      const finalState = await this.tauriService.invoke<Channel>('toggle_channel_favorite', { id: id });
      
      // Sync final state
      updateItemInPaginatedSignal(this.channels, finalState);
      updateItemInPaginatedSignal(this.recentChannels, finalState);

      // Handle Favorites List Special Case:
      // If we turned OFF favorite -> remove from favorites list
      // If we turned ON favorite -> add to favorites list (if we were viewing favorites? No, we just refresh if needed, or append?)
      // Simple logic: If removing, filter out. If adding, let next fetch handle it (or leave it be if viewing LiveTV).
      if (!finalState.isFavorite) {
          removeItemFromPaginatedSignal(this.favoriteChannels, id);
      } else {
          // If we are already viewing favorites, we might want to append it? 
          // Easier to just update if it exists. If it doesn't exist in list yet, we don't force push it to maintain sort order.
          updateItemInPaginatedSignal(this.favoriteChannels, finalState);
      }

      if (this.selectedChannel()?.id === id) this.selectedChannel.set(finalState);

      this.notificationService.show(`"${finalState.name}" ${finalState.isFavorite ? 'added to' : 'removed from'} favorites.`, 'info');
    } catch(err) {
      // Revert
      updateItemInPaginatedSignal(this.channels, originalState);
      updateItemInPaginatedSignal(this.favoriteChannels, originalState);
      updateItemInPaginatedSignal(this.recentChannels, originalState);
      if (this.selectedChannel()?.id === id) this.selectedChannel.set(originalState);
      console.error("Failed to toggle favorite:", err);
      this.notificationService.show(`Error updating favorite status: ${this._getErrorMessage(err)}`, 'error');
    }
  }
  
  async addToRecentlyWatched(channel: Channel) { 
    try {
      await this.tauriService.invoke('add_to_recently_watched', { channelId: channel.id });
      // Optional: Manually trigger a refresh of recentChannels if we are on that view, 
      // but usually next visit will fetch.
    } catch (err) {
      console.error('Failed to add to recently watched:', this._getErrorMessage(err));
    }
  }
  
  // VOD Helper methods ... (unchanged) ...
  getWatchHistoryFor(item: VODItem | Episode): WatchHistory | undefined {
    const key = 'episodeNumber' in item ? `episode-${item.id}` : `movie-${item.id}`;
    return this.watchHistory()[key];
  }
  
  getVODItemProgress(id: number, type: 'movie' | 'series'): { progress: number; isFinished: boolean } | undefined { 
    const key = type === 'movie' ? `movie-${id}` : `series-${id}`;
    const history = this.watchHistory()[key];
    const item = type === 'movie' ? this.movies().items.find(m => m.id === id) : this.series().items.find(s => s.id === id);

    if (history && item?.duration) {
      return { progress: (history.lastPlayedPosition / item.duration) * 100, isFinished: history.isFinished };
    }
    return undefined;
  }
  
  async toggleVODWatchlist(id: number, type: 'movie' | 'series') {
     // ... (Use original logic, unchanged for brevity) ...
     // Placeholder to keep code valid:
     const signalToUpdate = type === 'movie' ? this.movies : this.series;
     const selected = this.selectedVODItem();
     const item = signalToUpdate().items.find(i => i.id === id) ?? (selected?.id === id ? selected : undefined);
     if (!item) return;
     const original = {...item};
     const optimistic = {...item, isOnWatchlist: !item.isOnWatchlist};
     updateItemInPaginatedSignal(signalToUpdate, optimistic);
     try {
         const final = await this.tauriService.invoke<VODItem>('toggle_vod_watchlist', { id, type });
         updateItemInPaginatedSignal(signalToUpdate, final);
     } catch(e) { updateItemInPaginatedSignal(signalToUpdate, original); }
  }
  
  async toggleVODFavorite(id: number, type: 'movie' | 'series') {
     // ... (Use original logic, unchanged for brevity) ...
     const signalToUpdate = type === 'movie' ? this.movies : this.series;
     const selected = this.selectedVODItem();
     const item = signalToUpdate().items.find(i => i.id === id) ?? (selected?.id === id ? selected : undefined);
     if (!item) return;
     const original = {...item};
     const optimistic = {...item, isFavorite: !item.isFavorite};
     updateItemInPaginatedSignal(signalToUpdate, optimistic);
     try {
         const final = await this.tauriService.invoke<VODItem>('toggle_vod_favorite', { id, type });
         updateItemInPaginatedSignal(signalToUpdate, final);
     } catch(e) { updateItemInPaginatedSignal(signalToUpdate, original); }
  }

  setChannelSortOrder(order: SortOrder) { this.channelSortOrder.set(order); }
  setMovieSortOrder(order: SortOrder) { this.movieSortOrder.set(order); }
  setSeriesSortOrder(order: SortOrder) { this.seriesSortOrder.set(order); }

  async toggleChannelVisibility(id: number) {
    try {
      const updatedChannel = await this.tauriService.invoke<Channel>('toggle_channel_visibility', { id: id });
      
      // Sync across all lists
      const updateOrRemove = (sig: WritableSignal<PaginatedResponse<Channel>>, isShowingHidden: boolean) => {
          if (isShowingHidden !== updatedChannel.isHidden) {
              removeItemFromPaginatedSignal(sig, id);
          } else {
              updateItemInPaginatedSignal(sig, updatedChannel);
          }
      };

      const currentlyShowingHidden = this.showHiddenChannels();
      updateOrRemove(this.channels, currentlyShowingHidden);
      updateOrRemove(this.favoriteChannels, currentlyShowingHidden);
      updateOrRemove(this.recentChannels, currentlyShowingHidden);

      if (this.selectedChannel()?.id === id) {
         if (currentlyShowingHidden !== updatedChannel.isHidden) {
             // Deselect if it disappeared from view? optional.
             this.selectedChannel.set(updatedChannel); 
         } else {
             this.selectedChannel.set(updatedChannel);
         }
      }

      this.notificationService.show(`Channel "${updatedChannel.name}" is now ${updatedChannel.isHidden ? 'hidden' : 'visible'}.`, 'info');
    } catch (err) {
      console.error("Failed to toggle channel visibility:", err);
      this.notificationService.show(`Error updating channel visibility: ${this._getErrorMessage(err)}`, 'error');
    }
  }

  async batchSetChannelVisibility(ids: number[], isHidden: boolean) {
      if (ids.length === 0) return;
      try {
        await this.tauriService.invoke('batch_update_channel_visibility', { ids, isHidden: isHidden });
        
        const currentlyShowingHidden = this.showHiddenChannels();
        const handleBatch = (sig: WritableSignal<PaginatedResponse<Channel>>) => {
            if (currentlyShowingHidden !== isHidden) {
                 const idSet = new Set(ids);
                 sig.update(current => ({
                     ...current,
                     items: current.items.filter(c => !idSet.has(c.id)),
                     total: Math.max(0, current.total - ids.length)
                 }));
            }
        };

        handleBatch(this.channels);
        handleBatch(this.favoriteChannels);
        handleBatch(this.recentChannels);
        
        this.notificationService.show(`${ids.length} channels have been ${isHidden ? 'hidden' : 'made visible'}.`, 'success');
      } catch (err) {
        console.error("Failed to batch update channel visibility:", err);
        this.notificationService.show(`Error updating channels: ${this._getErrorMessage(err)}`, 'error');
      }
  }

  async batchSetChannelFavorite(ids: number[], isFavorite: boolean) {
      if (ids.length === 0) return;
      try {
        const updatedChannels = await this.tauriService.invoke<Channel[]>('batch_update_channel_favorite_status', { ids, isFavorite: isFavorite });
        const updatedMap = new Map(updatedChannels.map(c => [c.id, c]));
        
        const applyUpdates = (sig: WritableSignal<PaginatedResponse<Channel>>) => {
            sig.update(current => ({
                ...current,
                items: current.items.map(item => updatedMap.get(item.id) ?? item)
            }));
        };

        applyUpdates(this.channels);
        applyUpdates(this.recentChannels);
        
        // Special handling for Favorites list
        if (isFavorite) {
            // If adding, we technically should append, but order is unknown. 
            // Safer to not auto-add to view, just update logic if they exist.
            // Or we could refetch favorites.
             applyUpdates(this.favoriteChannels);
        } else {
            // If removing, filter them out
             const idSet = new Set(ids);
             this.favoriteChannels.update(current => ({
                 ...current,
                 items: current.items.filter(c => !idSet.has(c.id)),
                 total: Math.max(0, current.total - ids.length) // Approximate total fix
             }));
        }

        this.notificationService.show(`${ids.length} channels ${isFavorite ? 'added to' : 'removed from'} favorites.`, 'success');
      } catch (err) {
        console.error("Failed to batch update channel favorites:", err);
        this.notificationService.show(`Error updating favorites: ${this._getErrorMessage(err)}`, 'error');
      }
  }
}