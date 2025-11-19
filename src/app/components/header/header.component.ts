import { Component, ChangeDetectionStrategy, input, output, signal, ElementRef, inject, effect, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { MainView } from '../../app.component';
import { IptvService } from '../../services/iptv.service';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
  template: `
    <header class="flex flex-wrap items-center justify-between gap-y-4 gap-x-2 p-4 bg-gray-900/80 backdrop-blur-sm border-b border-gray-700/50 flex-shrink-0">
      <!-- Left: Logo & Title -->
      <div class="flex items-center space-x-2">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-8 h-8 text-sky-400">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 20.25h12m-7.5-3.75v3.75m3.75-3.75v3.75m-7.5-12v1.5m3.75-1.5v1.5m7.5-1.5v1.5m3.75-1.5v1.5M3 13.5h18M3 7.5h18M3 16.5h18m-18-9h18" />
        </svg>
        <h1 class="text-xl font-bold text-white">RebooTV</h1>
      </div>

      <!-- Center: Search & Nav -->
      <div class="w-full md:flex-1 md:w-auto order-last md:order-none flex flex-col items-center gap-4">
        <div class="relative w-full max-w-xl">
          <div class="flex items-center bg-gray-800 rounded-lg shadow-inner">
            <div class="relative dropdown-container">
              <button (click)="toggleDropdown()" class="flex-shrink-0 z-10 inline-flex items-center justify-between w-32 py-2.5 px-4 text-sm font-medium text-center text-gray-300 bg-gray-700/50 border border-transparent rounded-l-lg hover:bg-gray-600/50 focus:ring-2 focus:ring-sky-500" type="button">
                <span>{{ selectedScope() }}</span>
                <svg class="w-2.5 h-2.5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 10 6">
                  <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m1 1 4 4 4-4"/>
                </svg>
              </button>
              @if (isDropdownOpen()) {
                <div class="absolute top-full mt-2 z-20 bg-gray-700 divide-y divide-gray-600 rounded-lg shadow w-44">
                  <ul class="py-2 text-sm text-gray-200">
                    @for(scope of searchScopes; track scope) {
                      <li>
                        <button type="button" class="inline-flex w-full px-4 py-2 hover:bg-gray-600 hover:text-white" (click)="selectScope(scope)">{{ scope }}</button>
                      </li>
                    }
                  </ul>
                </div>
              }
            </div>
            <div class="relative w-full">
              <input 
                type="search"
                [value]="iptvService.searchTerm()"
                (input)="onSearch($event)"
                class="block p-2.5 w-full z-20 text-sm text-gray-100 bg-transparent rounded-r-lg border-l-gray-700/50 border-l-2 border border-transparent focus:outline-none focus:ring-sky-500 focus:border-sky-500 placeholder-gray-400" [placeholder]="'Search in ' + selectedScope() + '...'" required />
            </div>
          </div>
        </div>

        <nav class="hidden md:flex items-center space-x-2">
          @for (item of navItems; track item.view) {
            <a
              class="px-3 py-2 rounded-md text-sm font-medium cursor-pointer transition-colors"
              [class]="currentView() === item.view ? 'bg-sky-500/20 text-sky-300' : 'text-gray-300 hover:bg-gray-700/50 hover:text-white'"
              (click)="onNavigate(item.view)">
              {{ item.label }}
            </a>
          }
        </nav>
      </div>
      
      <!-- Right: Clock & Settings -->
      <div class="flex items-center justify-end">
        <span class="text-lg font-medium text-gray-300 mr-4 tabular-nums">
          {{ currentTime() | date:'h:mm a' }}
        </span>
        <button (click)="onNavigate('settings')" class="text-gray-400 hover:text-white" title="Settings">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.24-.438.613-.438.995s.145.755.438.995l1.003.827c.424.35.534.954.26 1.431l-1.296 2.247a1.125 1.125 0 0 1-1.37.49l-1.217-.456c-.355-.133-.75-.072-1.075.124a6.57 6.57 0 0 1-.22.127c-.331.183-.581.495-.645.87l-.213 1.281c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.941l-.213-1.281c-.063-.374-.313-.686-.645-.87a6.52 6.52 0 0 1-.22-.127c-.324-.196-.72-.257-1.075-.124l-1.217.456a1.125 1.125 0 0 1-1.37-.49l-1.296-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.437-.995s-.145-.755-.437-.995l-1.004-.827a1.125 1.125 0 0 1-.26-1.431l1.296-2.247a1.125 1.125 0 0 1 1.37-.49l1.217.456c.355.133.75.072 1.075-.124.072-.044.146-.087.22-.127.332-.183.582-.495.645-.87l.213-1.281Z" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
          </svg>
        </button>
      </div>
    </header>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:click)': 'onClickOutside($event)',
  },
})
export class HeaderComponent implements OnDestroy {
  iptvService = inject(IptvService);
  private elementRef = inject(ElementRef);
  currentView = input.required<MainView>();
  navigate = output<MainView>();

  isDropdownOpen = signal(false);
  readonly searchScopes = ['Live TV', 'Movies', 'Series'];
  selectedScope = signal(this.searchScopes[0]);
  currentTime = signal(new Date());

  readonly navItems: { view: MainView; label: string }[] = [
    { view: 'live-tv', label: 'Live TV' },
    { view: 'favorites', label: 'Favorites' },
    { view: 'recently-watched', label: 'Recently Watched' },
    { view: 'movies', label: 'Movies' },
    { view: 'series', label: 'Series' },
    { view: 'playlists', label: 'Playlists' },
  ];

  // --- NEW: RxJS Subject for Debounce ---
  private searchSubject = new Subject<string>();
  private searchSubscription: Subscription;

  constructor() {
    // --- NEW: Subscribe with Debounce ---
    this.searchSubscription = this.searchSubject.pipe(
      debounceTime(300), // Wait 300ms
      distinctUntilChanged()
    ).subscribe(term => {
      this.iptvService.setSearchTerm(term);
    });

    effect(() => {
      const view = this.currentView();
      switch (view) {
        case 'live-tv':
        case 'favorites':
        case 'recently-watched':
        case 'playlists':
        case 'settings':
          this.selectedScope.set('Live TV');
          break;
        case 'movies':
          this.selectedScope.set('Movies');
          break;
        case 'series':
          this.selectedScope.set('Series');
          break;
      }
    }, { allowSignalWrites: true });

    effect((onCleanup) => {
      const interval = setInterval(() => {
        this.currentTime.set(new Date());
      }, 1000);

      onCleanup(() => {
        clearInterval(interval);
      });
    });
  }

  ngOnDestroy() {
    this.searchSubscription.unsubscribe();
  }

  onNavigate(view: MainView): void {
    this.iptvService.setSearchTerm(''); // Clear search on navigation
    this.navigate.emit(view);
  }

  onSearch(event: Event): void {
    const term = (event.target as HTMLInputElement).value;
    // Send to subject instead of Service directly
    this.searchSubject.next(term);
  }

  toggleDropdown(): void {
    this.isDropdownOpen.update(open => !open);
  }

  selectScope(scope: string): void {
    this.selectedScope.set(scope);
    this.isDropdownOpen.set(false);
    
    switch(scope) {
      case 'Live TV':
        if (this.currentView() !== 'live-tv' && this.currentView() !== 'favorites' && this.currentView() !== 'recently-watched') {
          this.onNavigate('live-tv');
        }
        break;
      case 'Movies':
        this.onNavigate('movies');
        break;
      case 'Series':
        this.onNavigate('series');
        break;
    }
  }

  onClickOutside(event: Event): void {
    if (!this.isDropdownOpen()) {
      return;
    }
    const clickedElement = event.target as HTMLElement;
    const dropdownContainer = this.elementRef.nativeElement.querySelector('.dropdown-container');

    if (dropdownContainer && !dropdownContainer.contains(clickedElement)) {
      this.isDropdownOpen.set(false);
    }
  }
}