import { Injectable, NgZone, inject } from '@angular/core';
import { MOCK_CHANNELS, MOCK_PLAYLISTS, MOCK_CATEGORIES, MOCK_MOVIES, MOCK_SERIES, MOCK_SEASONS_AND_EPISODES, MOCK_MOVIE_CATEGORIES, MOCK_SERIES_CATEGORIES, MOCK_WATCH_HISTORY } from './mock-data';
import { AppSettings } from './settings.service';
import { Channel, Playlist, Category, VODItem, PaginatedResponse, WatchHistory, Season } from '../models/iptv.models';

// Manually define types that would normally come from '@tauri-apps/api'
export type UnlistenFn = () => void;
export interface TauriEvent<T> {
  payload: T;
  event: string;
  windowLabel: string;
}
export type EventCallback<T> = (event: TauriEvent<T>) => void;

const LOCAL_STORAGE_KEY = 'rebootv_mock_data';

@Injectable({
  providedIn: 'root',
})
export class TauriService {
  private ngZone: NgZone;
  private listeners: Map<string, Function[]> = new Map();

  // In-memory state for our mock backend
  private state = {
    playlists: MOCK_PLAYLISTS,
    channels: MOCK_CHANNELS,
    categories: MOCK_CATEGORIES,
    movies: MOCK_MOVIES,
    series: MOCK_SERIES,
    seasons: MOCK_SEASONS_AND_EPISODES,
    settings: {
      defaultView: 'live-tv',
      refreshOnStart: true,
      minimizeToTray: false,
      exitToTray: false,
      mpvParams: '--hwdec=auto',
      startVolume: 100,
      hwAccel: true,
      bufferSize: 'medium',
      epgTimeOffset: 0,
      epgRefreshFrequency: 12,
    } as AppSettings,
    watchHistory: MOCK_WATCH_HISTORY,
    recentlyWatched: new Set<number>(),
  };

  constructor() {
    this.ngZone = inject(NgZone);
    this.loadStateFromLocalStorage();
  }

  private loadStateFromLocalStorage(): void {
    const savedState = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState);
        // Merge saved state with defaults to handle new properties
        this.state = {
          ...this.state,
          ...parsed,
          settings: { ...this.state.settings, ...(parsed.settings || {}) },
          recentlyWatched: new Set(parsed.recentlyWatched || []),
        };
      } catch (e) {
        console.error("Failed to parse mock data from localStorage", e);
      }
    }
  }

  private saveStateToLocalStorage(): void {
    const stateToSave = {
      ...this.state,
      recentlyWatched: Array.from(this.state.recentlyWatched)
    };
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(stateToSave));
  }
  
  private emit<T>(event: string, payload: T): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      const tauriEvent: TauriEvent<T> = { payload, event, windowLabel: 'main' };
      eventListeners.forEach(handler => handler(tauriEvent));
    }
  }

  isTauriAvailable(): boolean {
    return false; // This is now a mock service
  }
  
  // --- COMMAND HANDLERS ---
  
  private async handleRefreshAll(): Promise<void> {
    console.log('[MockBackend] Starting refresh...');
    const activePlaylists = this.state.playlists.filter(p => p.isActive);

    // Simulate loading state
    activePlaylists.forEach(p => {
        if (p.status !== 'error') { // Don't change status if it's already in error
            p.status = 'loading';
            this.emit('playlist-update', p);
        }
    });
    
    // Simulate work
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Simulate completion
    activePlaylists.forEach(p => {
       if (p.status !== 'error') {
            p.status = 'active';
            p.lastUpdated = new Date().toISOString();
            this.emit('playlist-update', p);
       }
    });

    await new Promise(resolve => setTimeout(resolve, 500));
    this.emit('refresh-complete', undefined);
    console.log('[MockBackend] Refresh complete.');
  }
  
  // Fix: Replaced generic paginated handler with two specific ones.
  private handleGetChannelsPaginated(
    items: Channel[],
    options: { page: number, pageSize: number, searchTerm: string, sortBy: string, sortOrder: 'asc' | 'desc', filter?: any, showHidden?: boolean }
  ): PaginatedResponse<Channel> {
    let filteredItems = [...items];

    // Filter by hidden status first, and make it exclusive.
    if (options.showHidden) {
      filteredItems = filteredItems.filter(c => c.isHidden);
    } else {
      filteredItems = filteredItems.filter(c => !c.isHidden);
    }

    // Filtering logic
    if (options.filter?.type === 'favorites') {
      filteredItems = filteredItems.filter(c => c.isFavorite);
      if (options.filter.categoryId) {
        filteredItems = filteredItems.filter(c => c.categoryId === options.filter.categoryId);
      }
    } else if (options.filter?.type === 'recently-watched') {
      const watchedIds = Array.from(this.state.recentlyWatched).reverse();
      // Start with an ordered list of watched channels
      filteredItems = watchedIds
        .map(id => items.find(c => c.id === id))
        .filter((c): c is Channel => !!c);
      
      if (options.filter.categoryId) {
        filteredItems = filteredItems.filter(c => c.categoryId === options.filter.categoryId);
      }
    } else if (typeof options.filter === 'number') { // by categoryId for Live TV
      filteredItems = filteredItems.filter(c => c.categoryId === options.filter);
    }
    // No filter means all channels (filteredItems is already a copy of all items)

    // Searching applies after filtering
    if (options.searchTerm) {
      const term = options.searchTerm.toLowerCase();
      filteredItems = filteredItems.filter(item => item.name.toLowerCase().includes(term));
    }

    // Sorting applies after searching
    if (options.sortBy === 'name') {
        if (options.sortOrder === 'asc') {
            filteredItems.sort((a, b) => a.name.localeCompare(b.name));
        } else if (options.sortOrder === 'desc') {
            filteredItems.sort((a, b) => b.name.localeCompare(a.name));
        }
    }

    const total = filteredItems.length;
    const start = (options.page - 1) * options.pageSize;
    const end = start + options.pageSize;
    const paginatedItems = filteredItems.slice(start, end);

    return {
      items: paginatedItems,
      hasMore: end < total,
      total: total
    };
  }

  private handleGetVODPaginated(
    items: VODItem[], 
    options: { page: number, pageSize: number, searchTerm: string, sortBy?: string, sortOrder?: 'asc' | 'desc', filter?: any }
  ): PaginatedResponse<VODItem> {
      let filteredItems = [...items];

      // Filtering for VOD
      if (options.filter) {
        switch (options.filter.type) {
          case 'watchlist':
            filteredItems = filteredItems.filter(item => item.isOnWatchlist);
            break;
          case 'favorites':
            filteredItems = filteredItems.filter(item => item.isFavorite);
            break;
          case 'history': {
            const historyIds = new Set(Object.keys(this.state.watchHistory).map(k => parseInt(k.split('-')[1])));
            filteredItems = filteredItems.filter(item => historyIds.has(item.id));
            break;
          }
          case 'continue-watching': {
            const continueWatchingIds = new Set(Object.values(this.state.watchHistory)
              .filter(h => !h.isFinished)
              .map(h => parseInt(h.id.split('-')[1]))
            );
            filteredItems = filteredItems.filter(item => continueWatchingIds.has(item.id));
            break;
          }
          case 'category':
            if (options.filter.categoryName) {
              filteredItems = filteredItems.filter(item => item.genres.includes(options.filter.categoryName));
            }
            break;
        }
      }

      // Searching
      if (options.searchTerm) {
          const term = options.searchTerm.toLowerCase();
          filteredItems = filteredItems.filter(item => item.title.toLowerCase().includes(term));
      }

      // Sorting applies after searching
      if (options.sortBy === 'title') {
        if (options.sortOrder === 'asc') {
            filteredItems.sort((a, b) => a.title.localeCompare(b.title));
        } else if (options.sortOrder === 'desc') {
            filteredItems.sort((a, b) => b.title.localeCompare(a.title));
        }
      }

      const total = filteredItems.length;
      const start = (options.page - 1) * options.pageSize;
      const end = start + options.pageSize;
      const paginatedItems = filteredItems.slice(start, end);
      
      return {
          items: paginatedItems,
          hasMore: end < total,
          total: total
      };
  }


  async invoke<T>(cmd: string, args?: any): Promise<T> {
    console.log(`[MockBackend] Invoked: '${cmd}' with args:`, args);

    // Simulate async delay
    await new Promise(res => setTimeout(res, Math.random() * 150));

    // --- MOCK ERROR SIMULATION ---
    if (args?.searchTerm?.toLowerCase() === 'fail') {
      return Promise.reject({ message: 'Simulated failure: Search term "fail" was used.' });
    }
    if (cmd === 'refresh_playlist') {
        const playlistToRefresh = this.state.playlists.find(p => p.id === args.id);
        if (playlistToRefresh && playlistToRefresh.status === 'error') {
            return Promise.reject(`[Mock Error] Cannot refresh playlist in error state: ${playlistToRefresh.errorMessage}`);
        }
    }
    if (cmd === 'delete_playlist' && args.id === 4) { // ID of the error playlist
        return Promise.reject(new Error('[Mock Error] Permission denied: This playlist cannot be deleted by the user.'));
    }
    if (cmd === 'import_user_data') {
        return Promise.reject('[Mock Error] User cancelled file selection dialog.');
    }


    switch (cmd) {
      // Settings
      case 'get_settings':
        return this.state.settings as T;
      case 'save_settings':
        this.state.settings = { ...this.state.settings, ...args.settings };
        this.saveStateToLocalStorage();
        return undefined as T;

      // Playlists
      case 'get_playlists':
        return [...this.state.playlists] as T;
      case 'add_playlist': {
        const newPlaylist: Playlist = {
            ...args.playlistData,
            id: Date.now(),
            isActive: true,
            status: 'active',
        };
        this.state.playlists.push(newPlaylist);
        this.saveStateToLocalStorage();
        return newPlaylist as T;
      }
      case 'update_playlist': {
        this.state.playlists = this.state.playlists.map(p => p.id === args.playlist.id ? args.playlist : p);
        this.saveStateToLocalStorage();
        return args.playlist as T;
      }
      case 'delete_playlist':
        this.state.playlists = this.state.playlists.filter(p => p.id !== args.id);
        this.saveStateToLocalStorage();
        return undefined as T;
      case 'update_playlist_active_status':
        this.state.playlists.forEach(p => p.isActive = p.id === args.id ? args.isActive : false);
        this.saveStateToLocalStorage();
        return this.state.playlists.find(p => p.id === args.id) as T;
      case 'refresh_all_playlists':
        this.handleRefreshAll();
        return Promise.resolve(undefined as T);

      // Channels & Categories
      case 'get_categories':
        return [...this.state.categories] as T;
      case 'get_channels':
        // Fix: Use the correct paginated handler for channels.
        return this.handleGetChannelsPaginated(this.state.channels, args) as T;
      case 'toggle_channel_favorite': {
        const channel = this.state.channels.find(c => c.id === args.id);
        if (channel) {
            channel.isFavorite = !channel.isFavorite;
            this.saveStateToLocalStorage();
        }
        return channel as T;
      }
      case 'toggle_channel_visibility': {
          const channel = this.state.channels.find(c => c.id === args.id);
          if (channel) {
              channel.isHidden = !channel.isHidden;
              this.saveStateToLocalStorage();
          }
          return channel as T;
      }
      case 'batch_update_channel_visibility': {
          const idSet = new Set(args.ids);
          const updated: Channel[] = [];
          this.state.channels.forEach(c => {
              if (idSet.has(c.id)) {
                  c.isHidden = args.isHidden;
                  updated.push(c);
              }
          });
          this.saveStateToLocalStorage();
          return updated as T;
      }
      case 'batch_update_channel_favorite_status': {
          const idSet = new Set(args.ids);
          const updated: Channel[] = [];
          this.state.channels.forEach(c => {
              if (idSet.has(c.id)) {
                  c.isFavorite = args.isFavorite;
                  updated.push(c);
              }
          });
          this.saveStateToLocalStorage();
          return updated as T;
      }
      case 'toggle_category_visibility': {
          const category = this.state.categories.find(c => c.id === args.id);
          if (category) {
            category.isHidden = !category.isHidden;
            this.saveStateToLocalStorage();
          }
          return category as T;
      }
      case 'batch_update_category_visibility': {
          const idSet = new Set(args.ids);
          this.state.categories.forEach(c => {
              if (idSet.has(c.id)) {
                  c.isHidden = args.isHidden;
              }
          });
          this.saveStateToLocalStorage();
          return undefined as T;
      }

      // VOD
      case 'get_movies':
        // Fix: Use the correct paginated handler for VOD items.
        return this.handleGetVODPaginated(this.state.movies, args) as T;
      case 'get_series':
        // Fix: Use the correct paginated handler for VOD items.
        return this.handleGetVODPaginated(this.state.series, args) as T;
       case 'get_seasons_for_series':
          return (this.state.seasons[args.seriesId] ?? []) as T;
      case 'toggle_vod_favorite': {
          const list = args.type === 'movie' ? this.state.movies : this.state.series;
          const item = list.find(i => i.id === args.id);
          if(item) {
              item.isFavorite = !item.isFavorite;
              this.saveStateToLocalStorage();
          }
          return item as T;
      }
       case 'toggle_vod_watchlist': {
          const list = args.type === 'movie' ? this.state.movies : this.state.series;
          const item = list.find(i => i.id === args.id);
          if(item) {
              item.isOnWatchlist = !item.isOnWatchlist;
              this.saveStateToLocalStorage();
          }
          return item as T;
      }

      // History
      case 'add_to_recently_watched':
          // Fix: Re-add to move to end of set (most recent).
          this.state.recentlyWatched.delete(args.channelId);
          this.state.recentlyWatched.add(args.channelId);
          this.saveStateToLocalStorage();
          return undefined as T;

      // System / Notifications
      case 'schedule_notification':
        console.log(`[MockBackend] Scheduling notification:`, { title: args.title, body: args.body, scheduleAt: new Date(args.scheduleAt) });
        return undefined as T;
        
      // Data management
      case 'clear_image_cache':
      case 'clear_epg_cache':
        console.log(`[MockBackend] Cleared ${cmd}`);
        return undefined as T;
      case 'export_user_data':
        alert('[MockBackend] "Export Data" clicked. Functionality not implemented in mock.');
        return undefined as T;

      default:
        console.error(`[MockBackend] Unhandled command: ${cmd}`);
        return Promise.reject(`Unhandled command: ${cmd}`);
    }
  }

  async listen<T>(event: string, handler: EventCallback<T>): Promise<UnlistenFn> {
    const zonedHandler = (e: TauriEvent<T>) => {
      this.ngZone.run(() => handler(e));
    };

    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(zonedHandler);
    
    // Return an unlisten function
    return () => {
      const eventListeners = this.listeners.get(event);
      if (eventListeners) {
        const index = eventListeners.indexOf(zonedHandler);
        if (index > -1) {
          eventListeners.splice(index, 1);
        }
      }
    };
  }

  async scheduleNotification(title: string, body: string, scheduleAt: number): Promise<void> {
    return this.invoke('schedule_notification', { title, body, scheduleAt });
  }
}