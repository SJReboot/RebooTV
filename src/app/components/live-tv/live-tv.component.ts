import { Component, ChangeDetectionStrategy, inject, output, effect, signal, untracked, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IptvService, SortOrder } from '../../services/iptv.service';
import { TauriService } from '../../services/tauri.service'; // <--- Imported
import { Channel } from '../../models/iptv.models';
import { ChannelCardComponent } from '../channel-card/channel-card.component';
import { StatusBannerComponent } from '../status-banner/status-banner.component';

const PAGE_SIZE = 50;

@Component({
  selector: 'app-live-tv',
  standalone: true,
  imports: [CommonModule, ChannelCardComponent, StatusBannerComponent],
  template: `
   <div class="h-full flex flex-col">
    <!-- Control Header -->
    <div class="p-6 pb-4 flex-shrink-0">
      <div class="flex items-center justify-between gap-4 mb-4">
        <h2 class="text-3xl font-bold text-gray-200">{{ isMassEditing() ? 'Edit Channels' : (iptvService.showHiddenChannels() ? 'Hidden Channels' : 'Live TV') }}</h2>
        <div class="flex items-center gap-2">
          @if (!isMassEditing()) {
            <button (click)="iptvService.toggleShowHiddenChannels()" class="p-2.5 rounded-lg flex-shrink-0 transition-colors bg-gray-700 hover:bg-gray-600" [title]="iptvService.showHiddenChannels() ? 'Show visible channels' : 'Show hidden channels'">
              @if(iptvService.showHiddenChannels()) {
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-gray-300"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>
              } @else {
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-gray-400"><path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.243 4.243L6.228 6.228" /></svg>
              }
            </button>
            <select (change)="onSortChange($event)" [value]="iptvService.channelSortOrder()" class="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-sky-500 focus:border-sky-500 block w-full p-2.5">
              <option value="default">Default Order</option>
              <option value="asc">Name (A-Z)</option>
              <option value="desc">Name (Z-A)</option>
            </select>
          }
          <button (click)="toggleMassEdit()" class="px-3 py-2.5 rounded-lg flex-shrink-0 flex items-center gap-2 font-semibold text-sm transition-colors" [class]="isMassEditing() ? 'bg-sky-600 text-white hover:bg-sky-500' : 'bg-gray-700 hover:bg-gray-600'">
            @if(isMassEditing()) {
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
              <span>Done</span>
            } @else {
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /></svg>
              <span>Edit</span>
            }
          </button>
        </div>
      </div>
      <app-status-banner (navigateToPlaylists)="navigateToPlaylists.emit()"></app-status-banner>
    </div>
    
    <!-- Channel List -->
    <div class="flex-1 overflow-y-auto px-6" (scroll)="onScroll($event)" #channelList>
      @if (channels().items.length > 0) {
        <div class="grid grid-cols-1 gap-4 pt-4 pb-6">
          @for (channel of channels().items; track channel.id; let i = $index) {
            <app-channel-card 
              [channel]="channel" 
              [priority]="i < 12"
              [isSelected]="channel.id === (iptvService.selectedChannel()?.id) && !isMassEditing()"
              [isMassEditing]="isMassEditing()"
              [isMassSelected]="selectedForEdit().has(channel.id)"
              (select)="iptvService.selectChannel($event)"
              (play)="onPlayChannel($event)" 
              (toggleFavorite)="iptvService.toggleFavorite($event)"
              (toggleVisibility)="onToggleChannelVisibility($event)"
              (massSelectToggle)="onMassSelectToggle($event)"
            />
          }
        </div>
      }

      @if (isLoading() && channels().items.length === 0) {
        <div class="col-span-full text-center p-8">
            <div class="flex justify-center items-center gap-2 text-gray-400">
              <svg class="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Loading channels...</span>
            </div>
        </div>
      }

      @if (error()) {
          <div class="col-span-full text-center p-8 text-red-400">
              <p>Error loading channels: {{ error() }}</p>
              <button (click)="fetchData(false)" class="mt-4 px-4 py-2 bg-sky-600 text-white font-semibold rounded-lg hover:bg-sky-500 transition-colors">
                  Retry
              </button>
          </div>
      }

      @if (isLoading() && channels().items.length > 0) {
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
      
      @if (!isLoading() && channels().items.length === 0 && !error()) {
        <p class="text-gray-400 col-span-full text-center mt-8">{{ iptvService.showHiddenChannels() ? 'No hidden channels found.' : 'No channels to display.' }}</p>
      }
    </div>
    
    <!-- Mass Action Footer -->
    @if (isMassEditing()) {
      <div class="flex-shrink-0 bg-gray-900/80 backdrop-blur-sm px-6 py-3 border-t border-gray-700/50">
        <div class="flex items-center justify-between text-sm mb-2">
            <span class="font-semibold">{{ selectedForEdit().size }} selected</span>
            <div>
              <button (click)="selectAll()" class="ml-2 text-sky-400 hover:underline disabled:text-gray-500 disabled:no-underline" [disabled]="channels().items.length === 0">All</button>
              <span class="mx-1 text-gray-600">|</span>
              <button (click)="deselectAll()" class="text-sky-400 hover:underline disabled:text-gray-500 disabled:no-underline" [disabled]="selectedForEdit().size === 0">None</button>
            </div>
        </div>
        <div class="flex items-center gap-2 justify-center">
            <button (click)="onMassFavorite(true)" [disabled]="selectedForEdit().size === 0" class="p-2 flex-1 justify-center flex rounded-lg bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed" title="Add to Favorites">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 text-yellow-400"><path fill-rule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.006Z" clip-rule="evenodd" /></svg>
            </button>
            <button (click)="onMassFavorite(false)" [disabled]="selectedForEdit().size === 0" class="p-2 flex-1 justify-center flex rounded-lg bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed" title="Remove from Favorites">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.321l5.587.812a.562.562 0 0 1 .31.956l-4.048 3.945a.563.563 0 0 0-.162.498l.956 5.565a.563.563 0 0 1-.815.592L12 18.348a.563.563 0 0 0-.522 0l-4.994 2.625a.563.563 0 0 1-.815-.592l.956-5.565a.563.563 0 0 0-.162-.498L2.593 10.7a.562.562 0 0 1 .31-.956l5.587-.812a.563.563 0 0 0 .475-.321L11.48 3.5Z" /></svg>
            </button>
            <button (click)="onMassVisibility(true)" [disabled]="selectedForEdit().size === 0" class="p-2 flex-1 justify-center flex rounded-lg bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed" title="Hide Selected"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.243 4.243L6.228 6.228" /></svg></button>
            <button (click)="onMassVisibility(false)" [disabled]="selectedForEdit().size === 0" class="p-2 flex-1 justify-center flex rounded-lg bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed" title="Unhide Selected"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg></button>
        </div>
      </div>
    }
  </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LiveTvComponent {
  iptvService = inject(IptvService);
  tauriService = inject(TauriService); // <--- Inject Service
  
  navigateToPlaylists = output();

  @ViewChild('channelList') channelList!: ElementRef<HTMLElement>;

  channels = this.iptvService.channels;
  isLoading = this.iptvService.channelsLoading;
  error = this.iptvService.channelsError;
  
  isMassEditing = signal(false);
  selectedForEdit = signal<Set<number>>(new Set());
  private currentPage = signal(1);

  constructor() {
    effect(() => {
        const initialRefreshComplete = this.iptvService.initialRefreshComplete();
        this.iptvService.selectedCategoryId();
        this.iptvService.searchTerm();
        this.iptvService.channelSortOrder();
        this.iptvService.showHiddenChannels();

        untracked(() => {
            if (initialRefreshComplete) {
                this.fetchData(false);
            }
        });
    }, { allowSignalWrites: true });
  }

  // --- NEW: Play Handler ---
  onPlayChannel(channel: Channel) {
    console.log('[LiveTv] Playing channel via MPV:', channel.name);
    
    // 1. Track History
    this.iptvService.addToRecentlyWatched(channel);

    // 2. Launch Player
    this.tauriService.playStream(channel.streamUrl)
      .catch(err => console.error('[LiveTv] Failed to launch player:', err));
  }

  fetchData(loadMore: boolean) {
    if (this.isLoading()) {
        return;
    }

    if (loadMore) {
      this.currentPage.update(p => p + 1);
    } else {
      this.currentPage.set(1);
      if (this.channelList?.nativeElement) {
        this.channelList.nativeElement.scrollTop = 0;
      }
    }
    
    const sort = this.iptvService.channelSortOrder();
    const categoryFilter = this.iptvService.selectedCategoryId();

    const options = {
        page: this.currentPage(),
        pageSize: PAGE_SIZE,
        searchTerm: this.iptvService.searchTerm(),
        filter: categoryFilter === undefined ? null : categoryFilter,
        sortBy: sort === 'default' ? '' : 'name',
        sortOrder: sort === 'default' ? 'asc' : sort,
        showHidden: this.iptvService.showHiddenChannels(),
    };
    
    this.iptvService.fetchChannels(options, loadMore)
        .then(() => {})
        .catch(err => console.error('[Frontend Debug] fetchChannels failed:', err));
  }

  loadMore() {
      this.fetchData(true);
  }

  onScroll(event: Event) {
    const element = event.target as HTMLElement;
    const distanceToBottom = element.scrollHeight - element.scrollTop - element.clientHeight;

    if (distanceToBottom < 500) {
        if (!this.isLoading() && this.channels().hasMore) {
            this.loadMore();
        }
    }
  }

  onSortChange(event: Event) {
    const value = (event.target as HTMLSelectElement).value as SortOrder;
    this.iptvService.setChannelSortOrder(value);
  }

  onToggleChannelVisibility(channelId: number) {
    this.iptvService.toggleChannelVisibility(channelId);
  }

  toggleMassEdit() {
    this.isMassEditing.update(v => !v);
    this.deselectAll();
    if (!this.isMassEditing()) {
      this.iptvService.selectChannel(null); 
    }
  }

  onMassSelectToggle(channel: Channel) {
    this.selectedForEdit.update(currentSet => {
        if (currentSet.has(channel.id)) {
            currentSet.delete(channel.id);
        } else {
            currentSet.add(channel.id);
        }
        return new Set(currentSet);
    });
  }

  selectAll() {
    const allChannelIds = this.channels().items.map(c => c.id);
    this.selectedForEdit.set(new Set(allChannelIds));
  }

  deselectAll() {
    this.selectedForEdit.set(new Set());
  }

  onMassFavorite(isFavorite: boolean) {
    if (this.selectedForEdit().size === 0) return;
    this.iptvService.batchSetChannelFavorite(Array.from(this.selectedForEdit()), isFavorite);
    this.deselectAll();
  }

  onMassVisibility(isHidden: boolean) {
    if (this.selectedForEdit().size === 0) return;
    this.iptvService.batchSetChannelVisibility(Array.from(this.selectedForEdit()), isHidden);
    this.deselectAll();
  }
}