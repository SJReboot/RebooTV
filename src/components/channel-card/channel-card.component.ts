import { Component, ChangeDetectionStrategy, input, output, inject, computed, signal } from '@angular/core';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { Channel, EpgEntry } from '../../models/iptv.models';
import { IptvService } from '../../services/iptv.service';

@Component({
  selector: 'app-channel-card',
  standalone: true,
  imports: [CommonModule, NgOptimizedImage],
  template: `
    <div 
      class="flex items-center rounded-lg p-3 transition-all duration-150 cursor-pointer relative group"
      [class]="isSelected() ? 'bg-sky-700/50 ring-2 ring-sky-500' : 'bg-gray-800/50 hover:bg-gray-700'"
      [class.hover:ring-2]="!isMassEditing()"
      [class.hover:ring-sky-500]="!isMassEditing()"
      [class.ring-2]="isMassSelected()"
      [class.ring-sky-500]="isMassSelected()"
      (click)="onCardClick()"
      (dblclick)="onPlay()">
      
      @if (isMassEditing()) {
        <div class="flex-shrink-0 mr-3">
          <input 
            type="checkbox" 
            [checked]="isMassSelected()" 
            (change)="onCheckboxChange($event)"
            (click)="$event.stopPropagation()"
            class="w-5 h-5 bg-gray-600 border-gray-500 text-sky-500 rounded focus:ring-sky-500 focus:ring-2">
        </div>
      }

      <div class="flex-shrink-0 w-16 h-16 mr-4 relative bg-gray-700 rounded-md">
        @if (isImageLoading()) {
            <div class="absolute inset-0 bg-gray-700 animate-pulse rounded-md"></div>
        }
        <img 
          [ngSrc]="channel().logoUrl" 
          [priority]="priority()" 
          width="64" 
          height="64" 
          [alt]="channel().name + ' logo'" 
          class="rounded-md object-cover w-full h-full transition-opacity duration-300"
          [class.opacity-0]="isImageLoading()"
          (load)="isImageLoading.set(false)"
          (error)="isImageLoading.set(false)">
        @if (!isMassEditing()) {
          <div 
            (click)="onPlayButton($event)"
            class="absolute inset-0 bg-black/60 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" 
            title="Play channel">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-10 h-10 text-white/80 drop-shadow-lg hover:text-sky-400 hover:scale-110 transition-all duration-200">
                <path fill-rule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12Zm14.024-.983a1.125 1.125 0 0 1 0 1.966l-5.603 3.113A1.125 1.125 0 0 1 9 15.113V8.887c0-.857.921-1.4 1.671-.983l5.603 3.113Z" clip-rule="evenodd" />
              </svg>
          </div>
        }
      </div>
      <div class="flex-1 min-w-0">
        <h4 class="text-md font-semibold text-gray-100 truncate">{{ channel().name }}</h4>
        @if (currentProgram() || nextProgram()) {
          <div class="text-sm mt-1">
            <!-- Program Title Row -->
            <div class="flex items-baseline justify-between gap-4">
              <!-- Left Side: Current Program Title -->
              @if (currentProgram(); as currentProgram) {
                <div class="flex items-baseline gap-2 min-w-0">
                  <p class="truncate text-gray-200" [title]="currentProgram.title">{{ currentProgram.title }}</p>
                  <p class="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                    {{ currentProgram.startTime | date:'shortTime' }} - {{ currentProgram.endTime | date:'shortTime' }}
                  </p>
                </div>
              } @else {
                <!-- Placeholder to keep the 'Up next' on the right -->
                <div></div>
              }

              <!-- Right Side: Next Program -->
              @if (nextProgram(); as next) {
                <div class="text-xs text-gray-400 flex items-center gap-2 flex-shrink-0">
                  <span class="font-semibold hidden sm:inline">Up next:</span>
                  <span class="truncate max-w-[120px]" [title]="next.title">{{ next.title }}</span>
                  <span class="whitespace-nowrap">{{ next.startTime | date:'shortTime' }} - {{ next.endTime | date:'shortTime' }}</span>
                </div>
              }
            </div>

            <!-- Progress Bar (only if there's a current program) -->
            @if (currentProgram()) {
              <div class="w-full bg-gray-600 rounded-full h-1.5 mt-1.5">
                <div class="bg-sky-500 h-1.5 rounded-full" [style.width.%]="programProgress()"></div>
              </div>
            }
          </div>
        } @else {
          <p class="text-sm text-gray-500 mt-1">No EPG data available.</p>
        }
      </div>
      
      @if (!isMassEditing()) {
        <div class="ml-4 flex items-center flex-shrink-0 space-x-2">
          <button (click)="onToggleVisibility($event)" class="p-2 rounded-full hover:bg-gray-600/50 transition-colors" [title]="channel().isHidden ? 'Unhide channel' : 'Hide channel'">
            @if (channel().isHidden) {
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6 text-gray-400"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>
            } @else {
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6 text-gray-500"><path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.243 4.243L6.228 6.228" /></svg>
            }
          </button>
          <button (click)="onToggleFavorite($event)" class="p-2 rounded-full hover:bg-gray-600/50 transition-colors" [title]="channel().isFavorite ? 'Remove from favorites' : 'Add to favorites'">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6" [class]="channel().isFavorite ? 'text-yellow-400' : 'text-gray-500'">
              <path fill-rule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.006Z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChannelCardComponent {
  iptvService = inject(IptvService);
  channel = input.required<Channel>();
  priority = input<boolean>(false);
  isSelected = input<boolean>(false);
  isMassEditing = input<boolean>(false);
  isMassSelected = input<boolean>(false);
  
  play = output<Channel>();
  select = output<Channel>();
  massSelectToggle = output<Channel>();
  toggleFavorite = output<number>();
  toggleVisibility = output<number>();

  isImageLoading = signal(true);

  readonly currentProgram = computed(() => {
    const channel = this.channel();
    const now = this.iptvService.now();
    return channel.epg?.find(p => {
      const startTime = new Date(p.startTime);
      const endTime = new Date(p.endTime);
      return now >= startTime && now < endTime;
    });
  });

  readonly nextProgram = computed(() => {
    const channel = this.channel();
    if (!channel.epg || channel.epg.length === 0) {
        return undefined;
    }

    const now = this.iptvService.now();
    const currentProg = this.currentProgram();

    // Sort EPG entries by start time to ensure we get the correct next one
    const sortedEpg = [...channel.epg].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    
    if (currentProg) {
        const currentProgramEndTime = new Date(currentProg.endTime).getTime();
        // Find the first program that starts at or after the current one ends.
        return sortedEpg.find(p => new Date(p.startTime).getTime() >= currentProgramEndTime);
    } else {
        // If there's no current program, find the first program that starts after now.
        return sortedEpg.find(p => new Date(p.startTime).getTime() > now.getTime());
    }
  });

  readonly programProgress = computed(() => {
    const program = this.currentProgram();
    if (!program) return 0;

    const now = this.iptvService.now().getTime();
    const start = new Date(program.startTime).getTime();
    const end = new Date(program.endTime).getTime();

    if (now < start || now > end) return 0;
    return ((now - start) / (end - start)) * 100;
  });

  onPlay(): void {
    if (this.isMassEditing()) return;
    this.play.emit(this.channel());
  }
  
  onCardClick(): void {
    if (this.isMassEditing()) {
      this.massSelectToggle.emit(this.channel());
    } else {
      this.select.emit(this.channel());
    }
  }

  onCheckboxChange(event: Event): void {
    event.stopPropagation();
    this.massSelectToggle.emit(this.channel());
  }

  onPlayButton(event: MouseEvent): void {
    event.stopPropagation();
    this.onPlay();
  }

  onToggleFavorite(event: MouseEvent): void {
    event.stopPropagation();
    this.toggleFavorite.emit(this.channel().id);
  }

  onToggleVisibility(event: MouseEvent): void {
    event.stopPropagation();
    this.toggleVisibility.emit(this.channel().id);
  }
}