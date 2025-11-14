import { Component, ChangeDetectionStrategy, input, output, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Playlist } from '../../models/iptv.models';

@Component({
  selector: 'app-playlist-list-item',
  standalone: true,
  imports: [CommonModule, DatePipe],
  template: `
    <div class="bg-gray-800/50 rounded-lg p-6 flex flex-col h-full">
      <!-- Header: Icon, Name, Status, Toggle -->
      <div class="flex items-start justify-between gap-4 mb-4">
        <div class="flex items-start gap-4 min-w-0">
          <div class="flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center" [class]="typeClass()">
            <!-- Icon based on type -->
            @switch (playlist().type) {
              @case ('xtream') {
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
                </svg>
              }
              @case ('m3u') {
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z" />
                </svg>
              }
              @case ('stalker') {
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.97-2.122L7.5 15.45A3 3 0 1 1 13.5 18v-2.75m0 0a3 3 0 0 0-3-3m0 0-1.007-1.977A3 3 0 0 0 7.5 10.5a3 3 0 1 0-3 3m3-3-1.5-1.5m1.5 1.5-1.5 1.5" />
                </svg>
              }
            }
          </div>
          <div class="min-w-0">
            <h4 class="text-xl font-bold text-gray-100 truncate" [title]="playlist().name">{{ playlist().name }}</h4>
             @if (playlist().status === 'error' && playlist().errorMessage) {
                <p class="text-xs text-red-400 truncate mt-1" [title]="playlist().errorMessage">{{ playlist().errorMessage }}</p>
            }
          </div>
        </div>
        <label class="relative inline-flex items-center cursor-pointer flex-shrink-0" [title]="playlist().isActive ? 'Deactivate Playlist' : 'Activate Playlist'">
          <input type="checkbox" [checked]="playlist().isActive" (change)="toggleActive.emit(playlist().id)" class="sr-only peer">
          <div class="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-sky-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-600"></div>
        </label>
      </div>

      <!-- Details -->
      <div class="flex-1 space-y-3 text-sm my-4">
        <dl class="grid grid-cols-3 gap-x-4 gap-y-2">
          <dt class="font-medium text-gray-400 col-span-1">URL</dt>
          <dd class="text-gray-200 col-span-2 truncate font-mono text-xs" [title]="playlist().url">{{ playlist().url }}</dd>
          
          @if(playlist().username) {
              <dt class="font-medium text-gray-400 col-span-1">Username</dt>
              <dd class="text-gray-200 col-span-2 font-mono">{{ playlist().username }}</dd>
          }
          @if(playlist().password) {
              <dt class="font-medium text-gray-400 col-span-1">Password</dt>
              <dd class="text-gray-200 col-span-2 font-mono">**********</dd>
          }
          @if(playlist().macAddress) {
              <dt class="font-medium text-gray-400 col-span-1">MAC Address</dt>
              <dd class="text-gray-200 col-span-2 font-mono">{{ playlist().macAddress }}</dd>
          }
           @if (playlist().type === 'xtream') {
              <dt class="font-medium text-gray-400 col-span-1">Max Connections</dt>
              <dd class="text-gray-200 col-span-2">{{ playlist().maxConnections ?? 'N/A' }}</dd>

              <dt class="font-medium text-gray-400 col-span-1">Expires</dt>
              <dd class="text-gray-200 col-span-2">{{ playlist().expirationDate ? (playlist().expirationDate | date:'longDate') : 'N/A' }}</dd>
          }
          <dt class="font-medium text-gray-400 col-span-1">Last Refresh</dt>
          <dd class="text-gray-200 col-span-2">{{ playlist().lastUpdated ? (playlist().lastUpdated | date:'short') : 'Never' }}</dd>
        </dl>
      </div>

      <!-- Actions -->
      <div class="mt-auto pt-4 border-t border-gray-700/50 flex items-center justify-end gap-3 flex-shrink-0">
        <button (click)="refresh.emit(playlist().id)" [disabled]="playlist().status === 'loading'" class="p-2 rounded-lg text-sm font-semibold bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-wait" [title]="playlist().status === 'loading' ? 'Refreshing...' : 'Refresh'">
          @if(playlist().status === 'loading') {
            <svg class="animate-spin h-5 w-5 text-gray-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          } @else {
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
          }
        </button>
        <button (click)="edit.emit(playlist())" class="px-3 py-2 rounded-lg flex-shrink-0 flex items-center gap-2 font-semibold text-sm transition-colors bg-gray-700 hover:bg-gray-600">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" /></svg>
            <span>Edit</span>
        </button>
        <button (click)="onDelete()" class="p-2 rounded-lg text-sm font-semibold bg-gray-700 hover:bg-gray-600" title="Delete Playlist">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5">
            <path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
          </svg>
        </button>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlaylistListItemComponent {
  playlist = input.required<Playlist>();
  edit = output<Playlist>();
  refresh = output<number>();
  toggleActive = output<number>();
  delete = output<number>();

  typeClass = computed(() => {
    switch (this.playlist().type) {
      case 'xtream': return 'bg-sky-500/30 text-sky-300';
      case 'm3u': return 'bg-emerald-500/30 text-emerald-300';
      case 'stalker': return 'bg-amber-500/30 text-amber-300';
      default: return 'bg-gray-600';
    }
  });

  onDelete(): void {
    if (confirm(`Are you sure you want to delete "${this.playlist().name}"? This cannot be undone.`)) {
      this.delete.emit(this.playlist().id);
    }
  }
}
