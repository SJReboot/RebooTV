import { Component, ChangeDetectionStrategy, input, inject, output, computed, signal } from '@angular/core';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { VODItem } from '../../models/iptv.models';
import { IptvService } from '../../services/iptv.service';

@Component({
  selector: 'app-poster-card',
  standalone: true,
  imports: [CommonModule, NgOptimizedImage],
  template: `
    <div 
      class="group cursor-pointer rounded-lg overflow-hidden bg-gray-800/50 transition-all duration-200 relative"
      [class]="isSelected() ? 'ring-2 ring-sky-500 scale-105' : 'hover:ring-2 hover:ring-sky-500 hover:scale-105'"
      (click)="onSelect()"
      (dblclick)="onPlay()">
      <div class="aspect-[2/3] w-full relative bg-gray-700">
        @if (isImageLoading()) {
          <div class="absolute inset-0 bg-gray-700 animate-pulse"></div>
        }
        <img 
          [ngSrc]="item().imageUrl" 
          [priority]="priority()" 
          width="200" 
          height="300" 
          [alt]="item().title" 
          class="w-full h-full object-cover transition-opacity duration-300"
          [class.opacity-0]="isImageLoading()"
          (load)="isImageLoading.set(false)"
          (error)="isImageLoading.set(false)">
        
        <!-- Gradient overlay for title readability -->
        <div class="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 via-black/60 to-transparent pointer-events-none"></div>

        <!-- Title at the bottom -->
        <div class="absolute bottom-0 left-0 right-0 p-3">
          <h5 class="text-sm font-semibold text-gray-100 line-clamp-2" [title]="item().title">
            {{ item().title }}
          </h5>
        </div>
        
        @if (watchProgress(); as progress) {
          @if (progress.isFinished) {
             <div class="absolute top-2 left-2 bg-sky-500/90 text-white p-1.5 rounded-full" title="Watched">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-4 h-4">
                  <path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.052-.143Z" clip-rule="evenodd" />
                </svg>
            </div>
          } @else if (progress.progress > 0) {
            <div class="absolute bottom-0 left-0 right-0 h-1 bg-gray-600/50">
              <div class="bg-sky-500 h-full" [style.width.%]="progress.progress"></div>
            </div>
          }
        }

        <!-- Center Play/View Button Overlay -->
        <div class="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <button type="button" (click)="onPlay($event)" class="pointer-events-auto rounded-full text-white/80 drop-shadow-lg hover:text-sky-400 hover:scale-110 transition-all duration-200" [title]="item().type === 'movie' ? 'Play' : 'View Episodes'">
                @if (item().type === 'movie') {
                    <!-- Play Icon for Movies -->
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-16 h-16">
                        <path fill-rule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm14.024-.983a1.125 1.125 0 0 1 0 1.966l-5.603 3.113A1.125 1.125 0 0 1 9 15.113V8.887c0-.857.921-1.4 1.671-.983l5.603 3.113Z" clip-rule="evenodd" />
                    </svg>
                } @else {
                    <!-- Arrow Icon for Series -->
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-16 h-16">
                      <path fill-rule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25Zm4.28 10.28a.75.75 0 0 0 0-1.06l-3-3a.75.75 0 1 0-1.06 1.06l1.72 1.72H8.25a.75.75 0 0 0 0 1.5h5.69l-1.72 1.72a.75.75 0 1 0 1.06 1.06l3-3Z" clip-rule="evenodd" />
                    </svg>
                }
            </button>
        </div>
      
        <!-- Buttons that appear on hover -->
        <button (click)="onToggleWatchlist($event)" class="absolute top-2 left-2 p-2 rounded-full bg-black/50 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-sky-500" [title]="item().isOnWatchlist ? 'Remove from watchlist' : 'Add to watchlist'">
          @if (item().isOnWatchlist) {
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 text-sky-300">
              <path fill-rule="evenodd" d="M6.32 2.577a49.255 49.255 0 0 1 11.36 0c1.497.174 2.57 1.46 2.57 2.93V21a.75.75 0 0 1-1.085.67L12 18.089l-7.165 3.583A.75.75 0 0 1 3.75 21V5.507c0-1.47 1.073-2.756 2.57-2.93Z" clip-rule="evenodd" />
            </svg>
          } @else {
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-gray-200">
              <path stroke-linecap="round" stroke-linejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.5 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" />
            </svg>
          }
        </button>

         <button (click)="onToggleFavorite($event)" class="absolute top-2 right-2 p-2 rounded-full bg-black/50 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-sky-500" [title]="item().isFavorite ? 'Remove from favorites' : 'Add to favorites'">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5" [class]="item().isFavorite ? 'text-yellow-400' : 'text-gray-200'">
              <path fill-rule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.006Z" clip-rule="evenodd" />
            </svg>
          </button>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PosterCardComponent {
  iptvService = inject(IptvService);
  item = input.required<VODItem>();
  priority = input<boolean>(false);
  isSelected = input<boolean>(false);
  
  play = output<VODItem>();
  select = output<VODItem>();
  toggleFavorite = output<VODItem>();
  toggleWatchlist = output<VODItem>();

  isImageLoading = signal(true);

  watchProgress = computed(() => {
    return this.iptvService.getVODItemProgress(this.item().id, this.item().type);
  });

  onSelect(): void {
    this.select.emit(this.item());
  }

  onPlay(event?: MouseEvent): void {
    event?.stopPropagation();
    this.play.emit(this.item());
  }

  onToggleFavorite(event: MouseEvent): void {
    event.stopPropagation();
    this.toggleFavorite.emit(this.item());
  }
  
  onToggleWatchlist(event: MouseEvent): void {
    event.stopPropagation();
    this.toggleWatchlist.emit(this.item());
  }
}
