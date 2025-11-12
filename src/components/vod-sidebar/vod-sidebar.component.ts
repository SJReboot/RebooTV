import { Component, ChangeDetectionStrategy, inject, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IptvService, VODFilter } from '../../services/iptv.service';
import { VODCategory } from '../../models/iptv.models';

@Component({
  selector: 'app-vod-sidebar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <aside class="w-72 bg-gray-800/50 flex-shrink-0 p-4 overflow-y-auto border-r border-gray-700/50">
      <h3 class="text-lg font-semibold text-gray-300 mb-4 px-2">My Library</h3>
      <ul class="space-y-1">
        <li>
          <a
            class="flex items-center p-2 rounded-md cursor-pointer transition-colors duration-150 text-sm"
            [class]="selectedFilter().type === 'watchlist' ? 'bg-sky-500/20 text-sky-300 font-semibold' : 'text-gray-400 hover:bg-gray-700/50 hover:text-white'"
            (click)="onSelectFilter({ type: 'watchlist' })">
            My Watchlist
          </a>
        </li>
        <li>
          <a
            class="flex items-center p-2 rounded-md cursor-pointer transition-colors duration-150 text-sm"
            [class]="selectedFilter().type === 'favorites' ? 'bg-sky-500/20 text-sky-300 font-semibold' : 'text-gray-400 hover:bg-gray-700/50 hover:text-white'"
            (click)="onSelectFilter({ type: 'favorites' })">
            My Favorites
          </a>
        </li>
      </ul>

      <div class="border-t border-gray-700/50 my-3"></div>
      
      <ul class="space-y-1">
        <li>
          <a
            class="flex items-center p-2 rounded-md cursor-pointer transition-colors duration-150 text-sm"
            [class]="selectedFilter().type === 'all' ? 'bg-sky-500/20 text-sky-300 font-semibold' : 'text-gray-400 hover:bg-gray-700/50 hover:text-white'"
            (click)="onSelectFilter({ type: 'all' })">
            {{ view() === 'movies' ? 'All Movies' : 'All Series' }}
          </a>
        </li>
        <li>
          <a
            class="flex items-center p-2 rounded-md cursor-pointer transition-colors duration-150 text-sm"
            [class]="selectedFilter().type === 'continue-watching' ? 'bg-sky-500/20 text-sky-300 font-semibold' : 'text-gray-400 hover:bg-gray-700/50 hover:text-white'"
            (click)="onSelectFilter({ type: 'continue-watching' })">
            Continue Watching
          </a>
        </li>
        <li>
          <a
            class="flex items-center p-2 rounded-md cursor-pointer transition-colors duration-150 text-sm"
            [class]="selectedFilter().type === 'history' ? 'bg-sky-500/20 text-sky-300 font-semibold' : 'text-gray-400 hover:bg-gray-700/50 hover:text-white'"
            (click)="onSelectFilter({ type: 'history' })">
            History
          </a>
        </li>
      </ul>
      
      <h3 class="text-lg font-semibold text-gray-300 mt-6 mb-4 px-2">Categories</h3>
      <ul class="space-y-1">
        @for (category of categories(); track category.id) {
          <li>
            <a
              class="flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors duration-150 text-sm"
              [class]="selectedFilter().type === 'category' && selectedFilter().categoryName === category.name ? 'bg-sky-500/20 text-sky-300 font-semibold' : 'text-gray-400 hover:bg-gray-700/50 hover:text-white'"
              (click)="onSelectFilter({ type: 'category', categoryName: category.name })">
              <span class="truncate pr-2">{{ category.name }}</span>
            </a>
          </li>
        } @empty {
          <li class="p-2 text-sm text-gray-500">
            No categories found.
          </li>
        }
      </ul>
    </aside>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VODSidebarComponent {
  iptvService = inject(IptvService);
  view = input.required<'movies' | 'series'>();

  selectedFilter = this.iptvService.selectedVODFilter;
  
  categories = computed<VODCategory[]>(() => {
    return this.view() === 'movies' 
      ? this.iptvService.movieCategories()
      : this.iptvService.seriesCategories();
  });

  onSelectFilter(filter: VODFilter) {
    this.iptvService.selectVODFilter(filter);
  }
}