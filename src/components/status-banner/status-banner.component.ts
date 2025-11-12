import { Component, ChangeDetectionStrategy, inject, computed, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IptvService } from '../../services/iptv.service';

@Component({
  selector: 'app-status-banner',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (errorPlaylists().length > 0) {
      <div class="bg-red-500/20 border border-red-500/50 text-red-300 rounded-lg p-3 flex items-center justify-between gap-4 mb-6">
        <div class="flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-5 h-5 mr-3 flex-shrink-0">
            <path fill-rule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0ZM8.982 6.026a.75.75 0 0 0-1.065.063l-2.25 3.5a.75.75 0 0 0 .632 1.161h4.5a.75.75 0 0 0 .632-1.161l-2.25-3.5a.75.75 0 0 0-.567-.263Z" clip-rule="evenodd" />
          </svg>
          <p class="text-sm">
            <span class="font-semibold">{{ errorText() }}</span> Check credentials or connection and refresh.
          </p>
        </div>
        <button (click)="onNavigate()" class="px-3 py-1.5 text-sm font-semibold bg-red-500/30 hover:bg-red-500/50 rounded-md transition-colors flex-shrink-0">
          Manage
        </button>
      </div>
    } @else if (loadingPlaylists().length > 0) {
      <div class="bg-yellow-500/20 border border-yellow-500/50 text-yellow-300 rounded-lg p-3 flex items-center gap-4 mb-6">
        <svg class="animate-spin h-5 w-5 mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p class="text-sm">
          <span class="font-semibold">{{ loadingText() }}</span> Content may be temporarily unavailable.
        </p>
      </div>
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusBannerComponent {
  iptvService = inject(IptvService);
  navigateToPlaylists = output();

  errorPlaylists = this.iptvService.playlistsInError;
  loadingPlaylists = this.iptvService.playlistsLoading;

  errorText = computed(() => {
    const playlists = this.errorPlaylists();
    if (playlists.length === 1) {
      return `Playlist "${playlists[0].name}" has an error.`;
    }
    return `${playlists.length} playlists have errors.`;
  });

  loadingText = computed(() => {
    const playlists = this.loadingPlaylists();
    if (playlists.length === 1) {
      return `Refreshing "${playlists[0].name}"...`;
    }
    return `Refreshing ${playlists.length} playlists...`;
  });

  onNavigate(): void {
    this.navigateToPlaylists.emit();
  }
}
