import { Component, ChangeDetectionStrategy, signal, inject, effect, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from './components/header/header.component';
import { LiveTvComponent } from './components/live-tv/live-tv.component';
import { PlaylistsComponent } from './components/playlists/playlists.component';
import { FavoritesComponent } from './components/favorites/favorites.component';
import { Channel, Episode, VODItem } from './models/iptv.models';
import { CategorySidebarComponent } from './components/category-sidebar/category-sidebar.component';
import { MoviesComponent } from './components/movies/movies.component';
import { RecentlyWatchedComponent } from './components/recently-watched/recently-watched.component';
import { SeriesComponent } from './components/series/series.component';
import { ChannelDetailsSidebarComponent } from './components/channel-details-sidebar/channel-details-sidebar.component';
import { IptvService } from './services/iptv.service';
import { VODDetailsSidebarComponent } from './components/vod-details-sidebar/vod-details-sidebar.component';
import { VODSidebarComponent } from './components/vod-sidebar/vod-sidebar.component';
import { NotificationsComponent } from './components/notifications/notifications.component';
import { SettingsComponent } from './components/settings/settings.component';
import { SeriesDetailsComponent } from './components/series-details/series-details.component';

export type MainView = 'live-tv' | 'playlists' | 'favorites' | 'recently-watched' | 'movies' | 'series' | 'settings';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    HeaderComponent,
    LiveTvComponent,
    PlaylistsComponent,
    FavoritesComponent,
    CategorySidebarComponent,
    MoviesComponent,
    RecentlyWatchedComponent,
    SeriesComponent,
    ChannelDetailsSidebarComponent,
    VODDetailsSidebarComponent,
    VODSidebarComponent,
    NotificationsComponent,
    SettingsComponent,
    SeriesDetailsComponent,
  ],
  template: `
    @if (iptvService.isInitializing()) {
      <div class="fixed inset-0 bg-gray-900 flex items-center justify-center z-50">
        <div class="flex flex-col items-center text-center">
          <div class="flex items-center space-x-4 mb-6 animate-pulse-glow">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-16 h-16 text-sky-400">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 20.25h12m-7.5-3.75v3.75m3.75-3.75v3.75m-7.5-12v1.5m3.75-1.5v1.5m7.5-1.5v1.5m3.75-1.5v1.5M3 13.5h18M3 7.5h18M3 16.5h18m-18-9h18" />
            </svg>
            <h1 class="text-5xl font-bold text-white">RebooTV</h1>
          </div>
          <span class="text-lg text-gray-400">{{ loadingMessage() }}</span>
        </div>
      </div>
    } @else if (!iptvService.hasPlaylists()) {
       <div class="flex flex-col items-center justify-center min-h-screen p-6 bg-gray-900 text-white font-sans">
        <div class="text-center">
          <div class="flex items-center justify-center space-x-4 mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-12 h-12 text-sky-400">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 20.25h12m-7.5-3.75v3.75m3.75-3.75v3.75m-7.5-12v1.5m3.75-1.5v1.5m7.5-1.5v1.5m3.75-1.5v1.5M3 13.5h18M3 7.5h18M3 16.5h18m-18-9h18" />
            </svg>
            <h1 class="text-5xl font-bold text-white">RebooTV</h1>
          </div>
          <p class="text-xl text-gray-400 mb-8">Welcome! Let's add your first playlist to get started.</p>
        </div>
        <div class="w-full max-w-7xl">
          <app-playlists [isWelcomeScreen]="true"></app-playlists>
        </div>
      </div>
    } @else {
      <div class="flex flex-col h-screen bg-gray-900 text-white font-sans">
        <app-header [currentView]="currentView()" (navigate)="onNavigate($event)"></app-header>
        <div class="flex flex-1 overflow-hidden">
          @if (['live-tv', 'favorites', 'recently-watched'].includes(currentView())) {
            <app-category-sidebar></app-category-sidebar>
          }
          @if (['movies', 'series'].includes(currentView())) {
            <app-vod-sidebar [view]="currentView()"></app-vod-sidebar>
          }
          <main class="flex-1 overflow-hidden">
            @if (iptvService.activePlaylists().length === 0 && currentView() !== 'playlists' && currentView() !== 'settings') {
               <div class="flex flex-col items-center justify-center h-full text-center">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-16 h-16 text-gray-600 mb-4">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                  </svg>
                  <h3 class="text-2xl font-semibold text-gray-300">No Active Playlists</h3>
                  <p class="text-gray-500 mt-2 max-w-md">You have playlists, but none are currently active. Please go to the Playlists screen to enable one to see your content.</p>
                  <button (click)="onNavigate('playlists')" class="mt-6 px-4 py-2 bg-sky-600 text-white font-semibold rounded-lg hover:bg-sky-500 transition-colors">
                    Go to Playlists
                  </button>
                </div>
            } @else {
              @switch (currentView()) {
                @case ('live-tv') {
                  <app-live-tv (playChannel)="onPlayChannel($event)" (navigateToPlaylists)="onNavigate('playlists')"></app-live-tv>
                }
                @case ('playlists') {
                  <app-playlists></app-playlists>
                }
                @case ('favorites') {
                  <app-favorites (playChannel)="onPlayChannel($event)" (navigateToPlaylists)="onNavigate('playlists')"></app-favorites>
                }
                @case ('recently-watched') {
                  <app-recently-watched (playChannel)="onPlayChannel($event)" (navigateToPlaylists)="onNavigate('playlists')"></app-recently-watched>
                }
                @case ('movies') {
                  <app-movies (playVOD)="onPlayVOD($event)" (navigateToPlaylists)="onNavigate('playlists')"></app-movies>
                }
                @case ('series') {
                  @if (iptvService.selectedSeries(); as series) {
                    <app-series-details (playEpisode)="onPlayVOD($event)"></app-series-details>
                  } @else {
                    <app-series (navigateToPlaylists)="onNavigate('playlists')" (viewSeries)="onViewSeries($event)"></app-series>
                  }
                }
                @case ('settings') {
                  <app-settings></app-settings>
                }
              }
            }
          </main>
          @if (!['playlists', 'settings'].includes(currentView())) {
            <div class="w-[28rem] flex-shrink-0">
              <app-channel-details-sidebar (playChannel)="onPlayChannel($event)"></app-channel-details-sidebar>
              <app-vod-details-sidebar (playVOD)="onPlayVOD($event)"></app-vod-details-sidebar>
            </div>
          }
        </div>
      </div>
      <app-notifications></app-notifications>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit {
  iptvService = inject(IptvService);
  currentView = signal<MainView>('live-tv');

  private readonly loadingMessages = [
    'Connecting to backend...',
    'Loading your settings...',
    'Checking playlists...',
    'Getting everything ready...',
  ];
  loadingMessage = signal(this.loadingMessages[0]);

  constructor() {
    effect((onCleanup) => {
      if (this.iptvService.isInitializing()) {
        const interval = setInterval(() => {
          this.loadingMessage.update(currentMessage => {
            const currentIndex = this.loadingMessages.indexOf(currentMessage);
            const nextIndex = (currentIndex + 1) % this.loadingMessages.length;
            return this.loadingMessages[nextIndex];
          });
        }, 2000);

        onCleanup(() => {
          clearInterval(interval);
        });
      }
    });
  }

  ngOnInit(): void {
    this.iptvService.init();
  }

  onNavigate(view: MainView) {
    this.currentView.set(view);
    this.iptvService.selectChannel(null); // Close details when navigating
    this.iptvService.selectVODItem(null);
    this.iptvService.selectEpisode(null);
    this.iptvService.selectPlaylistForDetails(null);
    if (view !== 'series') {
      this.iptvService.selectSeries(null);
    }
    this.iptvService.selectVODFilter({ type: 'all' }); // Reset VOD filter

    // Reset all sort orders
    this.iptvService.setChannelSortOrder('default');
    this.iptvService.setMovieSortOrder('default');
    this.iptvService.setSeriesSortOrder('default');
  }

  onViewSeries(series: VODItem) {
    this.iptvService.selectSeries(series);
  }

  onPlayChannel(channel: Channel) {
    this.iptvService.addToRecentlyWatched(channel);
    const params = new URLSearchParams();
    params.set('url', channel.streamUrl);
    params.set('type', 'live-tv');
    params.set('id', channel.id.toString());
    params.set('name', channel.name);
    
    // The native desktop shell should register and handle this custom protocol.
    window.location.href = `iptvplayer://play?${params.toString()}`;
  }

  onPlayVOD(item: VODItem | Episode) {
    const watchHistory = this.iptvService.getWatchHistoryFor(item);
    const startPosition = (watchHistory && !watchHistory.isFinished) ? watchHistory.lastPlayedPosition : 0;

    const params = new URLSearchParams();
    params.set('url', item.streamUrl ?? '');
    params.set('start', startPosition.toString());
    params.set('id', item.id.toString());
    params.set('duration', (item.duration ?? 0).toString());

    const isEpisode = 'episodeNumber' in item;
    if (isEpisode) {
      const series = this.iptvService.selectedSeries();
      const season = this.iptvService.selectedSeason();
      if (!series || !season) return; // Should not happen

      params.set('type', 'series');
      params.set('name', `${series.title} | S${season.seasonNumber}E${item.episodeNumber} - ${item.title}`);
      params.set('seriesId', series.id.toString());
      params.set('seasonNumber', season.seasonNumber.toString());
      params.set('episodeNumber', item.episodeNumber.toString());

    } else { // Is a movie
      params.set('type', 'movie');
      params.set('name', item.title);
    }
    
    // The native desktop shell should register and handle this custom protocol.
    window.location.href = `iptvplayer://play?${params.toString()}`;
  }
}
