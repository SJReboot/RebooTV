import { Component, ChangeDetectionStrategy, inject, output, signal, computed, effect } from '@angular/core';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { IptvService } from '../../services/iptv.service';
import { Episode, Season, VODItem } from '../../models/iptv.models';
import { EpisodeCardComponent } from '../episode-card/episode-card.component';

@Component({
  selector: 'app-series-details',
  standalone: true,
  imports: [CommonModule, NgOptimizedImage, EpisodeCardComponent],
  template: `
    @if (selectedSeries(); as series) {
      <div class="h-full overflow-y-auto">
        <!-- Back Button -->
        <div class="p-4 sticky top-0 bg-gray-900/80 backdrop-blur-sm z-10">
          <button (click)="goBack()" class="flex items-center gap-2 text-gray-300 hover:text-white transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
            <span class="font-semibold text-sm">Back to Series</span>
          </button>
        </div>
        
        <!-- Hero Section -->
        <div class="flex flex-col md:flex-row items-start gap-6 p-6 cursor-pointer" (click)="reselectSeries(series)">
          <img [ngSrc]="series.imageUrl" priority width="200" height="300" [alt]="series.title + ' Poster'"
            class="rounded-lg object-cover w-40 h-60 md:w-48 md:h-72 flex-shrink-0 bg-gray-700 shadow-lg hover:scale-105 transition-transform">
          
          <div class="flex-1 space-y-4">
            <h2 class="text-4xl font-bold text-white">{{ series.title }}</h2>

            <!-- Actions: Watchlist & Favorite -->
            <div class="flex items-center gap-4">
              <button (click)="onToggleWatchlist(series); $event.stopPropagation()" class="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors" [title]="series.isOnWatchlist ? 'Remove from watchlist' : 'Add to watchlist'">
                @if (series.isOnWatchlist) {
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 text-sky-300">
                    <path fill-rule="evenodd" d="M6.32 2.577a49.255 49.255 0 0 1 11.36 0c1.497.174 2.57 1.46 2.57 2.93V21a.75.75 0 0 1-1.085.67L12 18.089l-7.165 3.583A.75.75 0 0 1 3.75 21V5.507c0-1.47 1.073-2.756 2.57-2.93Z" clip-rule="evenodd" />
                  </svg>
                  <span class="text-sm font-semibold text-gray-200">On Watchlist</span>
                } @else {
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-gray-300">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.5 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" />
                  </svg>
                  <span class="text-sm font-semibold text-gray-300">Add to Watchlist</span>
                }
              </button>
              <button (click)="onToggleFavorite(series); $event.stopPropagation()" class="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors" [title]="series.isFavorite ? 'Remove from favorites' : 'Add to favorites'">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5" [class]="series.isFavorite ? 'text-yellow-400' : 'text-gray-300'">
                  <path fill-rule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.006Z" clip-rule="evenodd" />
                </svg>
                <span class="text-sm font-semibold" [class]="series.isFavorite ? 'text-gray-100' : 'text-gray-300'">
                  {{ series.isFavorite ? 'Favorited' : 'Favorite' }}
                </span>
              </button>
            </div>

            <div class="flex items-center space-x-4 text-sm text-gray-400">
              <span>{{ series.releaseYear }}</span>
            </div>
            <div class="flex flex-wrap gap-2">
              @for(genre of series.genres; track genre) {
                <span class="px-2 py-1 text-xs font-medium bg-gray-700 text-gray-300 rounded-full">{{ genre }}</span>
              }
            </div>
            <p class="text-gray-300 leading-relaxed max-w-3xl">{{ series.description }}</p>
          </div>
        </div>

        <!-- Season Selector & Episodes -->
        <div class="p-6">
          <div class="flex items-center gap-4 mb-4">
             @if (seasons().length > 1) {
              <select (change)="onSeasonChange($event)" [value]="selectedSeasonNumber()" class="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-sky-500 focus:border-sky-500 block p-2.5">
                @for (season of seasons(); track season.id) {
                  <option [value]="season.seasonNumber">Season {{ season.seasonNumber }}</option>
                }
              </select>
            }
            <h3 class="text-2xl font-bold text-gray-200">Episodes</h3>
          </div>
          
          @if(isLoading()) {
             <div class="text-center p-8">
                <div class="flex justify-center items-center gap-2 text-gray-400">
                  <svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Loading episodes...</span>
                </div>
            </div>
          } @else {
             <div class="flex flex-col gap-3">
                @for(episode of episodes(); track episode.id; let i = $index) {
                    <app-episode-card
                        [episode]="episode"
                        [priority]="i < 12"
                        [isSelected]="episode.id === iptvService.selectedEpisode()?.id"
                        (select)="onSelectEpisode($event)"
                        (play)="onPlayEpisode($event)"
                    />
                } @empty {
                    <p class="col-span-full text-gray-400">No episodes found for this season.</p>
                }
             </div>
          }
        </div>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SeriesDetailsComponent {
  iptvService = inject(IptvService);
  playEpisode = output<Episode>();

  selectedSeries = this.iptvService.selectedSeries;
  seasons = this.iptvService.selectedSeriesSeasons;
  isLoading = this.iptvService.seasonsLoading;
  
  private selectedSeasonNumber = signal<number | null>(null);

  constructor() {
    effect(() => {
      // When seasons load, automatically select the first one.
      const seasonData = this.seasons();
      if (seasonData.length > 0 && this.selectedSeasonNumber() === null) {
        this.selectedSeasonNumber.set(seasonData[0].seasonNumber);
      }
    }, { allowSignalWrites: true });

     effect(() => {
       // When a season is selected, update the service.
       const seasonNum = this.selectedSeasonNumber();
       const season = this.seasons().find(s => s.seasonNumber === seasonNum);
       this.iptvService.selectSeason(season ?? null);
     });
  }

  currentSeason = computed<Season | undefined>(() => {
    const seasonNum = this.selectedSeasonNumber();
    if (seasonNum === null) return undefined;
    return this.seasons().find(s => s.seasonNumber === seasonNum);
  });
  
  episodes = computed<Episode[]>(() => {
    return this.currentSeason()?.episodes ?? [];
  });

  goBack(): void {
    this.iptvService.selectSeries(null);
  }

  reselectSeries(series: VODItem): void {
    this.iptvService.selectVODItem(series);
  }

  onSeasonChange(event: Event): void {
    const selectedNum = parseInt((event.target as HTMLSelectElement).value, 10);
    this.selectedSeasonNumber.set(selectedNum);
  }

  onSelectEpisode(episode: Episode): void {
    this.iptvService.selectEpisode(episode);
  }

  onPlayEpisode(episode: Episode): void {
    this.playEpisode.emit(episode);
  }

  onToggleFavorite(series: VODItem): void {
    this.iptvService.toggleVODFavorite(series.id, 'series');
  }

  onToggleWatchlist(series: VODItem): void {
    this.iptvService.toggleVODWatchlist(series.id, 'series');
  }
}
