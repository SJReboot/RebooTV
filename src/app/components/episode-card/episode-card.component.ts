import { Component, ChangeDetectionStrategy, input, output, signal } from '@angular/core';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { Episode } from '../../models/iptv.models';

@Component({
  selector: 'app-episode-card',
  standalone: true,
  imports: [CommonModule, NgOptimizedImage],
  template: `
    <div 
      class="group flex items-center p-3 rounded-lg transition-all duration-150 cursor-pointer bg-gray-800/50"
      [class]="isSelected() ? 'ring-2 ring-sky-500 bg-gray-700' : 'hover:ring-2 hover:ring-sky-500 hover:bg-gray-700/60'"
      (click)="onSelect()"
      (dblclick)="onPlay()">
      
      <!-- Thumbnail -->
      <div class="relative flex-shrink-0 w-40 h-[5.625rem] rounded-md overflow-hidden bg-gray-700">
         @if (isImageLoading()) {
          <div class="absolute inset-0 bg-gray-700 animate-pulse"></div>
        }
        <img 
          [ngSrc]="episode().imageUrl" 
          [priority]="priority()" 
          width="160" 
          height="90" 
          [alt]="episode().title" 
          class="w-full h-full object-cover transition-opacity duration-300"
          [class.opacity-0]="isImageLoading()"
          (load)="isImageLoading.set(false)"
          (error)="isImageLoading.set(false)">
        
        <!-- Center Play Button Overlay -->
        <div (click)="onPlay($event)" class="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" title="Play Episode">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-10 h-10 text-white/80 drop-shadow-lg hover:text-sky-400 hover:scale-110 transition-all duration-200">
                <path fill-rule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm14.024-.983a1.125 1.125 0 0 1 0 1.966l-5.603 3.113A1.125 1.125 0 0 1 9 15.113V8.887c0-.857.921-1.4 1.671-.983l5.603 3.113Z" clip-rule="evenodd" />
            </svg>
        </div>
      </div>

      <!-- Info -->
      <div class="flex-1 min-w-0 pl-4">
          <h5 class="text-md font-semibold text-gray-200 truncate" [title]="'E' + episode().episodeNumber + ' - ' + episode().title">
            E{{ episode().episodeNumber }} - {{ episode().title }}
          </h5>
          @if (episode().description) {
            <p class="text-sm text-gray-400 mt-1 line-clamp-2">
              {{ episode().description }}
            </p>
          }
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EpisodeCardComponent {
  episode = input.required<Episode>();
  priority = input<boolean>(false);
  isSelected = input<boolean>(false);
  
  play = output<Episode>();
  select = output<Episode>();

  isImageLoading = signal(true);

  onSelect(): void {
    this.select.emit(this.episode());
  }

  onPlay(event?: MouseEvent): void {
    event?.stopPropagation();
    this.play.emit(this.episode());
  }
}
