import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IptvService, SortOrder } from '../../services/iptv.service';
import { Category } from '../../models/iptv.models';

@Component({
  selector: 'app-category-sidebar',
  standalone: true,
  imports: [CommonModule],
  template: `
    <aside class="w-72 bg-gray-800/50 flex flex-col flex-shrink-0 p-4 border-r border-gray-700/50">
      <div class="flex-shrink-0">
        <div class="flex items-center justify-between mb-2 px-2">
          <h3 class="text-lg font-semibold text-gray-300">{{ isMassEditing() ? 'Edit Categories' : (showHiddenCategories() ? 'Hidden Categories' : 'Categories') }}</h3>
          @if (!isMassEditing()) {
            <button (click)="onToggleShowHiddenCategories()" class="p-1 rounded-full hover:bg-gray-700" [title]="showHiddenCategories() ? 'Show visible categories' : 'Show hidden categories'">
              @if(showHiddenCategories()) {
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-gray-300"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>
              } @else {
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5 text-gray-400"><path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.243 4.243L6.228 6.228" /></svg>
              }
            </button>
          }
        </div>
        <div class="flex items-center justify-between mb-4 px-2 gap-2">
          <select (change)="onSortChange($event)" [value]="sortOrder()" class="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-sky-500 focus:border-sky-500 block w-full p-2.5">
            <option value="default">Default Order</option>
            <option value="asc">Name (A-Z)</option>
            <option value="desc">Name (Z-A)</option>
          </select>
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

      <div class="flex-1 overflow-y-auto relative -mr-4 pr-4">
        <ul class="space-y-1">
          <li>
            <a
              class="flex items-center p-2 rounded-md cursor-pointer transition-colors duration-150 text-sm"
              [ngClass]="{
                'bg-sky-500/20': selectedCategoryId() === null && !isMassEditing(),
                'text-sky-300': selectedCategoryId() === null && !isMassEditing(),
                'font-semibold': selectedCategoryId() === null && !isMassEditing(),
                'text-gray-400': selectedCategoryId() !== null || isMassEditing(),
                'hover:bg-gray-700/50': selectedCategoryId() !== null && !isMassEditing(),
                'hover:text-white': selectedCategoryId() !== null && !isMassEditing(),
                'cursor-not-allowed': isMassEditing(),
                'opacity-50': isMassEditing()
              }"
              (click)="onSelect(null)">
              {{ showHiddenCategories() && !isMassEditing() ? 'All Hidden' : 'All Channels' }}
            </a>
          </li>
          @for (category of categoriesForDisplay(); track category.id) {
            <li>
              <div
                class="group flex items-center p-2 rounded-md cursor-pointer transition-colors duration-150 text-sm"
                [ngClass]="{
                  'bg-sky-500/20': category.id === selectedCategoryId() && !isMassEditing(),
                  'text-sky-300': category.id === selectedCategoryId() && !isMassEditing(),
                  'font-semibold': category.id === selectedCategoryId() && !isMassEditing(),
                  'text-gray-400': !(category.id === selectedCategoryId() && !isMassEditing()),
                  'hover:bg-gray-700/50': !(category.id === selectedCategoryId() && !isMassEditing()),
                  'hover:text-white': !(category.id === selectedCategoryId() && !isMassEditing()),
                  'bg-sky-600/30': selectedForEdit().has(category.id)
                }"
                (click)="onCategoryClick(category)">

                @if (isMassEditing()) {
                   <input
                      type="checkbox"
                      [checked]="selectedForEdit().has(category.id)"
                      (change)="onCheckboxChange($event, category)"
                      (click)="$event.stopPropagation()"
                      class="w-4 h-4 mr-3 bg-gray-600 border-gray-500 text-sky-500 rounded focus:ring-sky-500 focus:ring-2">
                }

                <span class="truncate pr-2 flex-1" [class.opacity-60]="isMassEditing() && category.isHidden">{{ category.name }}</span>

                @if (isMassEditing() && category.isHidden) {
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 text-gray-500 flex-shrink-0"><path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.243 4.243L6.228 6.228" /></svg>
                }
                @if (!isMassEditing()) {
                  <button (click)="onToggleCategoryVisibility($event, category.id)" class="p-1 rounded-full hover:bg-gray-600/50 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity flex-shrink-0" [title]="category.isHidden ? 'Unhide Category' : 'Hide Category'">
                    @if(category.isHidden) {
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 text-gray-300"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>
                    } @else {
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4 text-gray-400"><path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.243 4.243L6.228 6.228" /></svg>
                    }
                  </button>
                }
              </div>
            </li>
          } @empty {
            <li class="p-2 text-sm text-gray-500">
              @if(showHiddenCategories()) {
                No hidden categories.
              } @else {
                No categories found.
              }
            </li>
          }
        </ul>
      </div>

      @if (isMassEditing()) {
        <div class="flex-shrink-0 bg-gray-900/50 -mx-4 -mb-4 mt-2 px-4 py-2 border-t border-gray-700">
            <div class="flex items-center justify-between text-sm mb-2">
                 <span class="font-semibold">{{ selectedForEdit().size }} selected</span>
                 <div>
                    <button (click)="selectAll()" class="ml-2 text-sky-400 hover:underline disabled:text-gray-500 disabled:no-underline" [disabled]="categoriesForDisplay().length === 0">All</button>
                    <span class="mx-1 text-gray-600">|</span>
                    <button (click)="deselectAll()" class="text-sky-400 hover:underline disabled:text-gray-500 disabled:no-underline" [disabled]="selectedForEdit().size === 0">None</button>
                 </div>
            </div>
            <div class="flex items-center gap-2 justify-center">
                <button (click)="onMassVisibility(true)" [disabled]="selectedForEdit().size === 0" class="p-2 flex-1 justify-center flex rounded-lg bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed" title="Hide Selected"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.243 4.243L6.228 6.228" /></svg></button>
                <button (click)="onMassVisibility(false)" [disabled]="selectedForEdit().size === 0" class="p-2 flex-1 justify-center flex rounded-lg bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed" title="Unhide Selected"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg></button>
            </div>
        </div>
      }
    </aside>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategorySidebarComponent {
  iptvService = inject(IptvService);

  selectedCategoryId = this.iptvService.selectedCategoryId;
  showHiddenCategories = this.iptvService.showHiddenCategories;
  sortOrder = this.iptvService.categorySortOrder;
  isMassEditing = signal(false);
  selectedForEdit = signal<Set<number>>(new Set());

  private readonly categoriesForNormalMode = this.iptvService.categoriesForActivePlaylist;

  private readonly categoriesForEditMode = computed(() => {
    const activePls = this.iptvService.activePlaylists();
    if (activePls.length === 0) return [];
    const activePlaylistIds = new Set(activePls.map(p => p.id));

    let categories = this.iptvService.categories().filter(c => activePlaylistIds.has(c.playlistId));

    const order = this.sortOrder();
    if (order === 'asc') {
      categories = [...categories].sort((a, b) => a.name.localeCompare(b.name));
    } else if (order === 'desc') {
      categories = [...categories].sort((a, b) => b.name.localeCompare(a.name));
    }
    return categories;
  });

  readonly categoriesForDisplay = computed(() => {
    return this.isMassEditing() ? this.categoriesForEditMode() : this.categoriesForNormalMode();
  });

  onSelect(categoryId: number | null) {
    if (this.isMassEditing()) return;
    this.iptvService.selectCategory(categoryId);
  }

  onCategoryClick(category: Category) {
    if (this.isMassEditing()) {
      this.toggleSelection(category);
    } else {
      this.onSelect(category.id);
    }
  }

  onCheckboxChange(event: Event, category: Category): void {
    event.stopPropagation();
    this.toggleSelection(category);
  }

  onToggleShowHiddenCategories() {
    this.iptvService.toggleShowHiddenCategories();
  }

  onToggleCategoryVisibility(event: MouseEvent, categoryId: number) {
    event.stopPropagation();
    this.iptvService.toggleCategoryVisibility(categoryId);
  }

  onSortChange(event: Event) {
    const value = (event.target as HTMLSelectElement).value as SortOrder;
    this.iptvService.setCategorySortOrder(value);
  }

  toggleMassEdit() {
    this.isMassEditing.update(v => !v);
    this.deselectAll();
    // When entering edit mode, ensure "All Channels" is selected
    if (this.isMassEditing()) {
        this.iptvService.selectCategory(null);
    }
  }

  toggleSelection(category: Category) {
    this.selectedForEdit.update(currentSet => {
        if (currentSet.has(category.id)) {
            currentSet.delete(category.id);
        } else {
            currentSet.add(category.id);
        }
        return new Set(currentSet);
    });
  }

  selectAll() {
    const allCategoryIds = this.categoriesForEditMode().map(c => c.id);
    this.selectedForEdit.set(new Set(allCategoryIds));
  }

  deselectAll() {
    this.selectedForEdit.set(new Set());
  }

  onMassVisibility(isHidden: boolean) {
    if (this.selectedForEdit().size === 0) return;
    this.iptvService.batchSetCategoryVisibility(Array.from(this.selectedForEdit()), isHidden);
    this.deselectAll();
  }
}
