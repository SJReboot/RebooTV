import { Component, ChangeDetectionStrategy, inject, output, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IptvService, SortOrder } from '../../services/iptv.service';
import { VODItem } from '../../models/iptv.models';
import { PosterCardComponent } from '../poster-card/poster-card.component';
import { StatusBannerComponent } from '../status-banner/status-banner.component';

const PAGE_SIZE = 48;

@Component({
  selector: 'app-movies',
  standalone: true,
  imports: [CommonModule, PosterCardComponent, StatusBannerComponent],
  template: `
    <div class="h-full flex flex-col">
      <!-- Control Header -->
      <div class="p-6 pb-4 flex-shrink-0">
        <div class="flex items-center justify-between gap-4 mb-4">
          <h2 class="text-3xl font-bold text-gray-200">Movies</h2>
          <div class="flex items-center gap-2">
            <select (change)="onSortChange($event)" [value]="iptvService.movieSortOrder()" class="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-sky-500 focus:border-sky-500 block p-2.5">
              <option value="default">Default Order</option>
              <option value="asc">Title (A-Z)</option>
              <option value="desc">Title (Z-A)</option>
            </select>
          </div>
        </div>
        <app-status-banner (navigateToPlaylists)="navigateToPlaylists.emit()"></app-status-banner>
      </div>
      
      <!-- VOD List -->
      <div class="flex-1 overflow-y-auto px-6" (scroll)="onScroll($event)">
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4 pt-4 pb-6">
          @for (movie of movies().items; track movie.id; let i = $index) {
            <app-poster-card 
              [item]="movie" 
              [priority]="i < 16"
              [isSelected]="movie.id === (iptvService.selectedVODItem()?.id)"
              (select)="iptvService.selectVODItem($event)"
              (play)="playVOD.emit($event)"
              (toggleFavorite)="iptvService.toggleVODFavorite($event.id, 'movie')"
              (toggleWatchlist)="iptvService.toggleVODWatchlist($event.id, 'movie')"
            />
          }
        </div>

        @if (isLoading() && movies().items.length === 0) {
          <div class="col-span-full text-center p-8">
              <div class="flex justify-center items-center gap-2 text-gray-400">
                <svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Loading movies...</span>
              </div>
          </div>
        }

        @if (error()) {
            <div class="col-span-full text-center p-8 text-red-400">
                <p>Error loading movies: {{ error() }}</p>
                <button (click)="fetchData(false)" class="mt-4 px-4 py-2 bg-sky-600 text-white font-semibold rounded-lg hover:bg-sky-500 transition-colors">
                    Retry
                </button>
            </div>
        }

        @if (isLoading() && movies().items.length > 0) {
          <div class="col-span-full text-center p-4">
              <div class="flex justify-center items-center gap-2 text-gray-400">
                <svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Loading more...</span>
              </div>
          </div>
        }
        
        @if (!isLoading() && movies().items.length === 0 && !error()) {
          <p class="text-gray-400 col-span-full text-center mt-8">No movies found.</p>
        }
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MoviesComponent {
  iptvService = inject(IptvService);
  playVOD = output<VODItem>();
  navigateToPlaylists = output();

  movies = this.iptvService.movies;
  isLoading = this.iptvService.moviesLoading;
  error = this.iptvService.moviesError;
  
  private currentPage = signal(1);

  constructor() {
    effect(() => {
        // When filters or sort order change, reset and fetch the first page
        this.iptvService.selectedVODFilter();
        this.iptvService.searchTerm();
        this.iptvService.movieSortOrder();
        this.fetchData(false);
    }, { allowSignalWrites: true });
  }

  fetchData(loadMore: boolean) {
    if (this.isLoading()) return;
    
    if (loadMore) {
      this.currentPage.update(p => p + 1);
    } else {
      this.currentPage.set(1);
    }

    const sort = this.iptvService.movieSortOrder();
    const options = {
        page: this.currentPage(),
        pageSize: PAGE_SIZE,
        searchTerm: this.iptvService.searchTerm(),
        filter: this.iptvService.selectedVODFilter(),
        sortBy: sort === 'default' ? '' : 'title',
        sortOrder: sort === 'default' ? 'asc' : sort,
    };
    
    this.iptvService.fetchMovies(options, loadMore);
  }
  
  onSortChange(event: Event) {
    const value = (event.target as HTMLSelectElement).value as SortOrder;
    this.iptvService.setMovieSortOrder(value);
  }

  loadMore() {
      this.fetchData(true);
  }

  onScroll(event: Event) {
    const element = event.target as HTMLElement;
    // Load more when the user is 500px away from the bottom
    if (element.scrollHeight - element.scrollTop - element.clientHeight < 500) {
        if (!this.isLoading() && this.movies().hasMore) {
            this.loadMore();
        }
    }
  }
}
