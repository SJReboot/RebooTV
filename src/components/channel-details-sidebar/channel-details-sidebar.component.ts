import { Component, ChangeDetectionStrategy, computed, inject, signal, ElementRef, output } from '@angular/core';
import { CommonModule, NgOptimizedImage } from '@angular/common';
import { IptvService } from '../../services/iptv.service';
import { Channel, EpgEntry } from '../../models/iptv.models';
import { TauriService } from '../../services/tauri.service';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-channel-details-sidebar',
  standalone: true,
  imports: [CommonModule, NgOptimizedImage],
  template: `
    @if (selectedChannel(); as channel) {
      <aside 
        class="w-full h-full bg-gray-800/50 border-l border-gray-700/50 flex flex-col">
        <!-- Header -->
        <div class="p-4 flex-shrink-0">
          <div class="flex items-center justify-between">
            <div class="flex items-center min-w-0">
              <img [ngSrc]="channel.logoUrl" priority width="64" height="64" [alt]="channel.name + ' logo'" class="rounded-md object-cover w-16 h-16 flex-shrink-0">
              <h3 class="text-lg font-bold text-gray-100 ml-4 truncate">{{ channel.name }}</h3>
            </div>
            <button (click)="onClose()" class="p-2 rounded-full hover:bg-gray-700 ml-2 flex-shrink-0" title="Close details">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Actions -->
        <div class="px-4 pt-2 pb-4 flex-shrink-0 flex items-center space-x-4 border-b border-gray-700/50">
          <button (click)="onPlay(channel)" class="flex-1 bg-sky-600 hover:bg-sky-700 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6 mr-2">
              <path fill-rule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.647c1.295.742 1.295 2.545 0 3.286L7.279 20.99c-1.25.717-2.779-.217-2.779-1.643V5.653Z" clip-rule="evenodd" />
            </svg>
            Watch
          </button>
          <button (click)="onToggleFavorite(channel)" class="p-3 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors" [title]="channel.isFavorite ? 'Remove from favorites' : 'Add to favorites'">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6" [class]="channel.isFavorite ? 'text-yellow-400' : 'text-gray-200'">
              <path fill-rule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.006Z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>

        <!-- EPG Details -->
        <div class="flex-1 overflow-y-auto">
          @if (currentProgram(); as program) {
            <div class="p-4">
              <h4 class="text-sm font-semibold uppercase text-gray-400 mb-2">Now Playing</h4>
              <p class="font-semibold text-gray-100">{{ program.title }}</p>
              <p class="text-sm text-gray-400 mt-1">{{ program.description }}</p>
              <div class="flex items-center mt-3">
                <div class="w-full bg-gray-600 rounded-full h-1.5 mr-3">
                  <div class="bg-sky-500 h-1.5 rounded-full" [style.width.%]="programProgress()"></div>
                </div>
              </div>
              <p class="text-xs text-gray-500 text-right mt-1">{{ program.startTime | date:'shortTime' }} - {{ program.endTime | date:'shortTime' }}</p>
            </div>
          } @else {
            <div class="p-4">
                <p class="text-sm text-gray-500">No EPG data for current program.</p>
            </div>
          }

          <div class="p-4 border-t border-gray-700/50">
            <h4 class="text-sm font-semibold uppercase text-gray-400 mb-3">Up Next</h4>
            <ul class="space-y-1">
              @for (program of upcomingPrograms(); track program.id) {
                <li class="text-sm rounded-md hover:bg-gray-700/30 px-2 -mx-2">
                  <div class="py-1.5 flex items-center w-full">
                    <span class="w-20 text-gray-400 flex-shrink-0">{{ program.startTime | date:'shortTime' }}</span>
                    <div class="flex items-center min-w-0">
                      <span class="text-gray-300 truncate" [title]="program.title">{{ program.title }}</span>
                      <div class="relative notification-menu-container ml-2 flex-shrink-0">
                        <button (click)="toggleNotificationMenu($event, program.id)" class="p-1 rounded-full hover:bg-gray-600/50 transition-colors" title="Set a reminder">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 text-gray-400">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
                          </svg>
                        </button>
                        @if (notificationMenuOpenFor() === program.id) {
                          <div class="absolute bottom-full right-0 mb-2 z-20 bg-gray-600 rounded-lg shadow-lg w-40 overflow-hidden">
                            <ul class="text-sm text-gray-200">
                               <li><button (click)="setReminder(channel, program, 5)" class="w-full text-left px-4 py-2 hover:bg-gray-500/70 transition-colors">5 mins before</button></li>
                               <li><button (click)="setReminder(channel, program, 10)" class="w-full text-left px-4 py-2 hover:bg-gray-500/70 transition-colors">10 mins before</button></li>
                               <li><button (click)="setReminder(channel, program, 30)" class="w-full text-left px-4 py-2 hover:bg-gray-500/70 transition-colors">30 mins before</button></li>
                            </ul>
                          </div>
                        }
                      </div>
                    </div>
                  </div>
                </li>
              } @empty {
                <li class="text-sm text-gray-500 px-2">No upcoming program information.</li>
              }
            </ul>
          </div>
        </div>
      </aside>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:click)': 'onClickOutside($event)',
  },
})
export class ChannelDetailsSidebarComponent {
  iptvService = inject(IptvService);
  tauriService = inject(TauriService);
  notificationService = inject(NotificationService);
  elementRef = inject(ElementRef);
  
  playChannel = output<Channel>();
  notificationMenuOpenFor = signal<number | null>(null);
  selectedChannel = this.iptvService.selectedChannel;

  currentProgram = computed<EpgEntry | undefined>(() => {
    const channel = this.selectedChannel();
    if (!channel) return undefined;
    const now = this.iptvService.now();
    return channel.epg?.find(p => {
      const startTime = new Date(p.startTime);
      const endTime = new Date(p.endTime);
      return now >= startTime && now < endTime;
    });
  });

  programProgress = computed<number>(() => {
    const program = this.currentProgram();
    if (!program) return 0;
    const now = this.iptvService.now().getTime();
    const start = new Date(program.startTime).getTime();
    const end = new Date(program.endTime).getTime();
    if (now < start || now > end) return 0;
    return ((now - start) / (end - start)) * 100;
  });

  upcomingPrograms = computed<EpgEntry[]>(() => {
    const channel = this.selectedChannel();
    if (!channel) return [];
    const now = this.iptvService.now();
    return channel.epg
      .filter(p => new Date(p.startTime) > now)
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  });

  onPlay(channel: Channel): void {
    this.playChannel.emit(channel);
  }
  
  onToggleFavorite(channel: Channel): void {
    this.iptvService.toggleFavorite(channel.id);
  }

  onClose(): void {
    this.iptvService.selectChannel(null);
  }

  toggleNotificationMenu(event: MouseEvent, programId: number): void {
    event.stopPropagation();
    this.notificationMenuOpenFor.update(current => current === programId ? null : programId);
  }

  async setReminder(channel: Channel, program: EpgEntry, minutesBefore: number): Promise<void> {
    const scheduleAt = new Date(program.startTime).getTime() - minutesBefore * 60 * 1000;
    const now = Date.now();
    
    if (scheduleAt > now) {
      const title = `${channel.name} - Reminder`;
      const body = `Your program "${program.title}" is starting in ${minutesBefore} minutes.`;
      try {
        await this.tauriService.scheduleNotification(title, body, scheduleAt);
        this.notificationService.show(`Reminder set for "${program.title}".`, 'success');
      } catch(e) {
        this.notificationService.show('Failed to set reminder.', 'error');
      }
    } else {
        this.notificationService.show(`Cannot set reminder for a program that has already started.`, 'error');
    }

    this.notificationMenuOpenFor.set(null);
  }

  onClickOutside(event: Event): void {
    if (this.notificationMenuOpenFor() === null) {
      return;
    }
    const target = event.target as HTMLElement;
    if (!target.closest('.notification-menu-container')) {
      this.notificationMenuOpenFor.set(null);
    }
  }
}
