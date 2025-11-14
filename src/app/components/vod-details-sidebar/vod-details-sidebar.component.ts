import { Component, ChangeDetectionStrategy, inject, output } from '@angular/core';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { IptvService } from '../../services/iptv.service';
import { Episode, VODItem } from '../../models/iptv.models';

@Component({
  selector: 'app-vod-details-sidebar',
  standalone: true,
  imports: [CommonModule, NgOptimizedImage],
  template: `
    @if (selectedVODItem(); as item) {
      <aside 
        class="w-full h-full bg-gray-800 border-l border-gray-700/50 flex flex-col">
        
        <div class="flex flex-col h-full">
          <!-- Header -->
          <div class="p-4 flex-shrink-0">
            <div class="flex items-start justify-between">
              <div class="flex items-center min-w-0">
                <img [ngSrc]="item.imageUrl" priority width="80" height="120" [alt]="item.title + ' poster'" class="rounded-md object-cover w-20 h-30 flex-shrink-0 bg-gray-700 shadow-lg">
                <div class="ml-4 mt-2">
                  <h3 class="text-xl font-bold text-gray-100 truncate leading-tight">{{ item.title }}</h3>
                  <p class="text-sm text-gray-400">{{ item.releaseYear }}</p>
                </div>
              </div>
              <button (click)="onClose()" class="p-2 rounded-full hover:bg-gray-700 ml-2 flex-shrink-0 self-start" title="Close details">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <!-- Actions -->
          <div class="px-4 pt-2 pb-4 flex-shrink-0 flex items-center space-x-4 border-b border-gray-700/50">
            @if (item.type === 'movie') {
              <button (click)="onPlay(item)" class="flex-1 bg-sky-600 hover:bg-sky-700 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6 mr-2">
                  <path fill-rule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.647c1.295.742 1.295 2.545 0 3.286L7.279 20.99c-1.25.717-2.779-.217-2.779-1.643V5.653Z" clip-rule="evenodd" />
                </svg>
                Watch
              </button>
            } @else {
               <button (click)="onViewEpisodes(item)" class="flex-1 bg-sky-600 hover:bg-sky-700 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6 mr-2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
                View Episodes
              </button>
            }

            <button (click)="onToggleWatchlist(item)" class="p-3 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors" [title]="item.isOnWatchlist ? 'Remove from watchlist' : 'Add to watchlist'">
              @if (item.isOnWatchlist) {
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6 text-sky-300">
                  <path fill-rule="evenodd" d="M6.32 2.577a49.255 49.255 0 0 1 11.36 0c1.497.174 2.57 1.46 2.57 2.93V21a.75.75 0 0 1-1.085.67L12 18.089l-7.165 3.583A.75.75 0 0 1 3.75 21V5.507c0-1.47 1.073-2.756 2.57-2.93Z" clip-rule="evenodd" />
                </svg>
              } @else {
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6 text-gray-300">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.5 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" />
                </svg>
              }
            </button>
             <button (click)="onToggleFavorite(item)" class="p-3 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors" [title]="item.isFavorite ? 'Remove from favorites' : 'Add to favorites'">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6" [class]="item.isFavorite ? 'text-yellow-400' : 'text-gray-200'">
                <path fill-rule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.006Z" clip-rule="evenodd" />
              </svg>
            </button>
          </div>

          <!-- VOD Details -->
          <div class="flex-1 overflow-y-auto p-4 space-y-4">
            <div class="flex items-center space-x-4 text-sm text-gray-400">
              <span>{{ item.releaseYear }}</span>
              @if (item.duration) {
                <span class="w-1 h-1 rounded-full bg-gray-500"></span>
                <span>{{ formatDuration(item.duration) }}</span>
              }
            </div>
             <div class="flex flex-wrap gap-2">
              @for(genre of item.genres; track genre) {
                <span class="px-2 py-1 text-xs font-medium bg-gray-700 text-gray-300 rounded-full">{{ genre }}</span>
              }
            </div>
            <div>
              <p class="text-sm text-gray-300 leading-relaxed">{{ item.description }}</p>
            </div>
          </div>
        </div>
      </aside>
    } @else if (selectedEpisode()) {
      <aside 
        class="w-full h-full bg-gray-800 border-l border-gray-700/50 flex flex-col">
        <div class="flex flex-col h-full">
          <!-- Header -->
          <div class="p-4 flex-shrink-0">
            <div class="flex items-start justify-between">
              <div class="flex items-start min-w-0">
                <img [ngSrc]="selectedEpisode()!.imageUrl" priority width="160" height="90" [alt]="selectedEpisode()!.title + ' thumbnail'" class="rounded-md object-cover w-40 h-[5.625rem] flex-shrink-0 bg-gray-700 shadow-lg">
                <div class="ml-4 mt-1">
                  @if (selectedSeries(); as series) {
                    <h4 class="text-md text-gray-300 truncate leading-tight" [title]="series.title">{{ series.title }}</h4>
                  }
                  @if (selectedSeason(); as season) {
                    <h3 class="text-lg font-bold text-gray-100 truncate leading-tight" [title]="'S' + season.seasonNumber + 'E' + selectedEpisode()!.episodeNumber + ' - ' + selectedEpisode()!.title">
                      S{{season.seasonNumber}}E{{selectedEpisode()!.episodeNumber}} - {{ selectedEpisode()!.title }}
                    </h3>
                  }
                </div>
              </div>
              <button (click)="onClose()" class="p-2 rounded-full hover:bg-gray-700 ml-2 flex-shrink-0 self-start" title="Close details">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <!-- Actions -->
          <div class="px-4 pt-2 pb-4 flex-shrink-0 flex items-center space-x-4 border-b border-gray-700/50">
            <button (click)="onPlay(selectedEpisode()!)" class="flex-1 bg-sky-600 hover:bg-sky-700 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6 mr-2">
                <path fill-rule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.647c1.295.742 1.295 2.545 0 3.286L7.279 20.99c-1.25.717-2.779-.217-2.779-1.643V5.653Z" clip-rule="evenodd" />
              </svg>
              Watch
            </button>
          </div>

          <!-- Episode Details -->
          <div class="flex-1 overflow-y-auto p-4 space-y-4">
             @if (selectedEpisode()!.duration) {
              <div class="text-sm text-gray-400">
                <span>{{ formatDuration(selectedEpisode()!.duration) }}</span>
              </div>
            }
            <div>
              <p class="text-sm text-gray-300 leading-relaxed">{{ selectedEpisode()!.description }}</p>
            </div>
          </div>
        </div>
      </aside>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VODDetailsSidebarComponent {
  iptvService = inject(IptvService);
  playVOD = output<VODItem | Episode>();

  selectedVODItem = this.iptvService.selectedVODItem;
  selectedEpisode = this.iptvService.selectedEpisode;
  selectedSeries = this.iptvService.selectedSeries;
  selectedSeason = this.iptvService.selectedSeason;

  onClose(): void {
    if (this.selectedVODItem()) {
      this.iptvService.selectVODItem(null);
    } else if (this.selectedEpisode()) {
      this.iptvService.selectEpisode(null);
    }
  }

  onPlay(item: VODItem | Episode): void {
    this.playVOD.emit(item);
  }
  
  onViewEpisodes(item: VODItem): void {
    this.iptvService.selectSeries(item);
  }

  onToggleWatchlist(item: VODItem): void {
    this.iptvService.toggleVODWatchlist(item.id, item.type);
  }

  onToggleFavorite(item: VODItem): void {
    this.iptvService.toggleVODFavorite(item.id, item.type);
  }

  formatDuration(seconds: number | undefined): string {
    if (seconds === undefined || seconds <= 0) {
      return '';
    }
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    let result = '';
    if (hours > 0) {
      result += `${hours}h `;
    }
    if (minutes > 0) {
      result += `${minutes}m`;
    }
    return result.trim();
  }
}