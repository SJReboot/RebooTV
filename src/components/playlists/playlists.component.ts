import { Component, ChangeDetectionStrategy, inject, signal, computed, input, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IptvService } from '../../services/iptv.service';
import { PlaylistCardComponent } from '../playlist-card/playlist-card.component';
import { Playlist } from '../../models/iptv.models';
import { PlaylistListItemComponent } from '../playlist-list-item/playlist-list-item.component';

type StatusFilter = 'all' | 'active' | 'inactive';
type TypeFilter = 'all' | 'xtream' | 'm3u' | 'stalker';
type SortKey = 'default' | 'name-asc' | 'name-desc';

@Component({
  selector: 'app-playlists',
  imports: [CommonModule, PlaylistCardComponent, PlaylistListItemComponent],
  template: `
    @if(isWelcomeScreen()) {
      <div class="flex items-center justify-center h-full">
        <div class="w-full max-w-2xl p-4">
          <app-playlist-card
            [isAdding]="true"
            (add)="handleAdd($event)">
          </app-playlist-card>
        </div>
      </div>
    } @else {
      <div class="flex h-full">
        <!-- Sidebar -->
        <aside class="w-72 bg-gray-800/50 flex flex-col flex-shrink-0 p-4 border-r border-gray-700/50">
          <div class="space-y-3 flex-shrink-0 mb-4">
            <button (click)="startAdding()" class="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm transition-colors font-semibold bg-sky-600 text-white hover:bg-sky-500">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                <span>New Playlist</span>
              </button>
              <button (click)="iptvService.refreshAllPlaylists()" class="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm transition-colors font-semibold bg-gray-700 hover:bg-gray-600">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
                  <span>Refresh All</span>
                </button>
          </div>

          <div class="flex-1 overflow-y-auto -mr-4 pr-4">
            <h3 class="text-lg font-semibold text-gray-300 mb-4 px-2">Types</h3>
            <ul class="space-y-1">
              <li><button (click)="typeFilter.set('all')" class="w-full text-left flex items-center p-2 rounded-md cursor-pointer text-sm" [class]="typeFilter() === 'all' ? 'bg-sky-500/20 text-sky-300 font-semibold' : 'text-gray-400 hover:bg-gray-700/50'">All</button></li>
              <li><button (click)="typeFilter.set('xtream')" class="w-full text-left flex items-center p-2 rounded-md cursor-pointer text-sm" [class]="typeFilter() === 'xtream' ? 'bg-sky-500/20 text-sky-300 font-semibold' : 'text-gray-400 hover:bg-gray-700/50'">Xtream</button></li>
              <li><button (click)="typeFilter.set('m3u')" class="w-full text-left flex items-center p-2 rounded-md cursor-pointer text-sm" [class]="typeFilter() === 'm3u' ? 'bg-sky-500/20 text-sky-300 font-semibold' : 'text-gray-400 hover:bg-gray-700/50'">M3U</button></li>
              <li><button (click)="typeFilter.set('stalker')" class="w-full text-left flex items-center p-2 rounded-md cursor-pointer text-sm" [class]="typeFilter() === 'stalker' ? 'bg-sky-500/20 text-sky-300 font-semibold' : 'text-gray-400 hover:bg-gray-700/50'">Stalker</button></li>
            </ul>

            <h3 class="text-lg font-semibold text-gray-300 mt-6 mb-4 px-2">Status</h3>
            <ul class="space-y-1">
              <li><button (click)="statusFilter.set('all')" class="w-full text-left flex items-center p-2 rounded-md cursor-pointer text-sm" [class]="statusFilter() === 'all' ? 'bg-sky-500/20 text-sky-300 font-semibold' : 'text-gray-400 hover:bg-gray-700/50'">All</button></li>
              <li><button (click)="statusFilter.set('active')" class="w-full text-left flex items-center p-2 rounded-md cursor-pointer text-sm" [class]="statusFilter() === 'active' ? 'bg-sky-500/20 text-sky-300 font-semibold' : 'text-gray-400 hover:bg-gray-700/50'">Active</button></li>
              <li><button (click)="statusFilter.set('inactive')" class="w-full text-left flex items-center p-2 rounded-md cursor-pointer text-sm" [class]="statusFilter() === 'inactive' ? 'bg-sky-500/20 text-sky-300 font-semibold' : 'text-gray-400 hover:bg-gray-700/50'">Inactive</button></li>
            </ul>
          </div>
        </aside>

        <!-- Main Content -->
        <main class="flex-1 overflow-y-auto p-6">
          @if (viewMode() === 'add' || viewMode() === 'edit') {
            <div class="max-w-3xl mx-auto">
                <app-playlist-card
                  [playlist]="editingPlaylist()"
                  [isAdding]="viewMode() === 'add'"
                  [isEditing]="viewMode() === 'edit'"
                  (add)="handleAdd($event)"
                  (save)="handleSave($event)"
                  (cancel)="handleCancel()">
                </app-playlist-card>
            </div>
          } @else {
            <!-- Playlist List View -->
            <div class="flex items-center justify-between gap-4 mb-6">
                <h2 class="text-3xl font-bold text-gray-200">Playlists ({{ filteredPlaylists().length }})</h2>
                <select (change)="onSortChange($event)" [value]="sortOrder()" class="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-sky-500 focus:border-sky-500 block p-2.5">
                    <option value="default">Default Order</option>
                    <option value="name-asc">Name (A-Z)</option>
                    <option value="name-desc">Name (Z-A)</option>
                </select>
            </div>
            
            <div class="grid grid-cols-1 xl:grid-cols-2 gap-4">
              @for(playlist of filteredPlaylists(); track playlist.id) {
                <app-playlist-list-item 
                  [playlist]="playlist"
                  (edit)="handleEdit($event)"
                  (toggleActive)="iptvService.togglePlaylistActive($event)"
                  (refresh)="iptvService.refreshPlaylist($event)"
                  (delete)="handleDelete($event)"
                />
              } @empty {
                <div class="text-center py-16 px-4 text-gray-500 rounded-lg bg-gray-800/30 col-span-full">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-16 h-16 mx-auto mb-4 text-gray-600">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.353-.026.692-.04 1.048-.04s.695.014 1.048.04c1.13.094 1.976 1.057 1.976 2.192v1.392m-.001 7.5h.001" />
                    </svg>
                    <h3 class="text-xl font-semibold text-gray-300">No Playlists Found</h3>
                    <p class="mt-2 max-w-sm mx-auto">Your current filter settings did not return any results. Try adjusting the filters or add a new playlist.</p>
                </div>
              }
            </div>
          }
        </main>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlaylistsComponent {
  iptvService = inject(IptvService);
  isWelcomeScreen = input(false);

  viewMode = signal<'list' | 'add' | 'edit'>('list');
  editingPlaylist = signal<Playlist | null>(null);

  statusFilter = signal<StatusFilter>('all');
  typeFilter = signal<TypeFilter>('all');
  sortOrder = signal<SortKey>('default');

  private allPlaylists = this.iptvService.playlists;
  
  filteredPlaylists = computed(() => {
    let playlists = this.allPlaylists();
    
    // Status filter
    const status = this.statusFilter();
    if (status !== 'all') {
      if (status === 'active') {
        playlists = playlists.filter(p => p.isActive);
      } else if (status === 'inactive') {
        playlists = playlists.filter(p => !p.isActive);
      }
    }

    // Type filter
    const type = this.typeFilter();
    if (type !== 'all') {
      playlists = playlists.filter(p => p.type === type);
    }
    
    // Sorting
    const sort = this.sortOrder();
    if (sort === 'name-asc') {
      playlists = [...playlists].sort((a,b) => a.name.localeCompare(b.name));
    } else if (sort === 'name-desc') {
      playlists = [...playlists].sort((a,b) => b.name.localeCompare(a.name));
    }

    return playlists;
  });

  constructor() {
    effect(() => {
      // When in welcome mode and no playlists exist, automatically trigger the 'add' form.
      if (this.isWelcomeScreen() && !this.iptvService.hasPlaylists()) {
        this.viewMode.set('add');
      }
    }, { allowSignalWrites: true });
  }

  onSortChange(event: Event) {
    this.sortOrder.set((event.target as HTMLSelectElement).value as SortKey);
  }

  handleEdit(playlist: Playlist): void {
    this.editingPlaylist.set(playlist);
    this.viewMode.set('edit');
  }

  startAdding(): void {
    this.editingPlaylist.set(null);
    this.viewMode.set('add');
  }

  async handleAdd(newPlaylistData: Omit<Playlist, 'id' | 'isActive' | 'status'>): Promise<void> {
    await this.iptvService.addPlaylist(newPlaylistData);
    this.viewMode.set('list');
  }

  handleCancel(): void {
    this.viewMode.set('list');
    this.editingPlaylist.set(null);
  }

  async handleSave(playlist: Playlist): Promise<void> {
    await this.iptvService.updatePlaylist(playlist);
    this.viewMode.set('list');
    this.editingPlaylist.set(null);
  }

  async handleDelete(id: number): Promise<void> {
    await this.iptvService.deletePlaylist(id);
    // Ensure we return to the list view if the deleted item was being edited
    if (this.editingPlaylist()?.id === id) {
      this.viewMode.set('list');
      this.editingPlaylist.set(null);
    }
  }
}