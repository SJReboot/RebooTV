import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl } from '@angular/forms';
// Fix: Import AppSettings to strongly type the form.
import { SettingsService, AppSettings } from '../../services/settings.service';
import { debounceTime } from 'rxjs/operators';
import { NotificationService } from '../../services/notification.service';
import { TauriService } from '../../services/tauri.service';
import { IptvService } from '../../services/iptv.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="h-full overflow-y-auto p-6">
      <div class="max-w-4xl mx-auto">
        <h2 class="text-3xl font-bold text-gray-200 mb-8">Settings</h2>

        <form [formGroup]="settingsForm" class="space-y-12">
          <!-- General Section -->
          <section>
            <h3 class="text-xl font-semibold text-sky-400 border-b-2 border-sky-400/30 pb-2 mb-6">General</h3>
            <div class="space-y-6">
              <!-- Default View -->
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                <label for="defaultView" class="text-gray-300">Default view on startup</label>
                <div class="md:col-span-2">
                  <select id="defaultView" formControlName="defaultView" class="w-full max-w-xs bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-sky-500 focus:border-sky-500 block p-2.5">
                    <option value="live-tv">Live TV</option>
                    <option value="favorites">Favorites</option>
                    <option value="recently-watched">Recently Watched</option>
                    <option value="movies">Movies</option>
                    <option value="series">Series</option>
                  </select>
                </div>
              </div>
              <!-- Refresh on Start -->
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                <div>
                  <label for="refreshOnStart" class="text-gray-300">Refresh all sources on start</label>
                  <p class="text-xs text-gray-500 mt-1">Automatically check for content updates when the application launches.</p>
                </div>
                <div class="md:col-span-2 pt-1">
                  <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" id="refreshOnStart" formControlName="refreshOnStart" class="sr-only peer">
                    <div class="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-sky-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-600"></div>
                  </label>
                </div>
              </div>
            </div>
          </section>

          <!-- System & Tray Section -->
          <section>
            <h3 class="text-xl font-semibold text-sky-400 border-b-2 border-sky-400/30 pb-2 mb-6">System & Tray</h3>
            <div class="space-y-6">
              <!-- Minimize to Tray -->
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                <div>
                  <label for="minimizeToTray" class="text-gray-300">Minimize to system tray</label>
                  <p class="text-xs text-gray-500 mt-1">When enabled, minimizing the window will hide it from the taskbar and place it in the system tray.</p>
                </div>
                <div class="md:col-span-2 pt-1">
                  <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" id="minimizeToTray" formControlName="minimizeToTray" class="sr-only peer">
                    <div class="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-sky-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-600"></div>
                  </label>
                </div>
              </div>
              <!-- Exit to Tray -->
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                <div>
                  <label for="exitToTray" class="text-gray-300">Close button minimizes to tray</label>
                  <p class="text-xs text-gray-500 mt-1">When enabled, clicking the close button will minimize the app to the tray instead of quitting.</p>
                </div>
                <div class="md:col-span-2 pt-1">
                  <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" id="exitToTray" formControlName="exitToTray" class="sr-only peer">
                    <div class="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-sky-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-600"></div>
                  </label>
                </div>
              </div>
            </div>
          </section>

          <!-- Playback Section -->
          <section>
            <h3 class="text-xl font-semibold text-sky-400 border-b-2 border-sky-400/30 pb-2 mb-6">Playback</h3>
            <div class="space-y-6">
              <!-- Global MPV Parameters -->
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                <label for="mpvParams" class="text-gray-300">Global MPV Parameters</label>
                <div class="md:col-span-2">
                  <textarea id="mpvParams" formControlName="mpvParams" rows="3" class="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-sky-500 focus:border-sky-500 block w-full p-2.5" placeholder="e.g., --hwdec=auto --profile=low-latency"></textarea>
                  <p class="text-xs text-gray-500 mt-1">Advanced users only. Invalid parameters may prevent playback.</p>
                </div>
              </div>
              <!-- Volume on Start -->
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                <label for="startVolume" class="text-gray-300">Volume on start</label>
                <div class="md:col-span-2 flex items-center gap-4 w-full max-w-xs">
                  <input type="range" id="startVolume" formControlName="startVolume" min="0" max="100" class="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer">
                  <span class="text-sm text-gray-300 font-mono w-8 text-right">{{ settingsForm.get('startVolume')?.value }}</span>
                </div>
              </div>
              <!-- Hardware Acceleration -->
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                <div>
                  <label for="hwAccel" class="text-gray-300">Enable hardware acceleration</label>
                  <p class="text-xs text-gray-500 mt-1">Offloads video decoding to the GPU (via MPV) for smoother playback and lower CPU usage. Recommended on most systems.</p>
                </div>
                <div class="md:col-span-2 pt-1">
                  <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" id="hwAccel" formControlName="hwAccel" class="sr-only peer">
                    <div class="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-sky-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-600"></div>
                  </label>
                </div>
              </div>
              <!-- Buffer Size -->
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                <div>
                  <label for="bufferSize" class="text-gray-300">Buffer Size</label>
                  <p class="text-xs text-gray-500 mt-1">Buffers the stream in memory (via MPV) to reduce stuttering on unstable connections. May increase initial load time.</p>
                </div>
                <div class="md:col-span-2 pt-1">
                  <select id="bufferSize" formControlName="bufferSize" class="w-full max-w-xs bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-sky-500 focus:border-sky-500 block p-2.5">
                    <option value="off">Off</option>
                    <option value="small">Small</option>
                    <option value="medium">Medium</option>
                    <option value="large">Large</option>
                  </select>
                </div>
              </div>
            </div>
          </section>

          <!-- EPG & Guide Section -->
          <section>
            <h3 class="text-xl font-semibold text-sky-400 border-b-2 border-sky-400/30 pb-2 mb-6">EPG & Guide</h3>
            <div class="space-y-6">
              <!-- EPG Time Offset -->
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                <div>
                  <label for="epgTimeOffset" class="text-gray-300">EPG Time Offset</label>
                  <p class="text-xs text-gray-500 mt-1">Adjusts the entire program guide time. Use this to fix incorrect EPG times from your provider.</p>
                </div>
                <div class="md:col-span-2">
                  <select id="epgTimeOffset" formControlName="epgTimeOffset" class="w-full max-w-xs bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-sky-500 focus:border-sky-500 block p-2.5">
                    @for (opt of timeOffsetOptions; track opt.value) {
                      <option [value]="opt.value">{{ opt.label }}</option>
                    }
                  </select>
                </div>
              </div>
              <!-- EPG Refresh Frequency -->
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                <div>
                  <label for="epgRefreshFrequency" class="text-gray-300">EPG Refresh Frequency</label>
                  <p class="text-xs text-gray-500 mt-1">How often to automatically download new program guide data in the background.</p>
                </div>
                <div class="md:col-span-2">
                  <select id="epgRefreshFrequency" formControlName="epgRefreshFrequency" class="w-full max-w-xs bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-sky-500 focus:border-sky-500 block p-2.5">
                    <option value="4">Every 4 hours</option>
                    <option value="8">Every 8 hours</option>
                    <option value="12">Every 12 hours</option>
                    <option value="24">Every 24 hours</option>
                  </select>
                </div>
              </div>
            </div>
          </section>

          <!-- Data & Cache Section -->
          <section>
            <h3 class="text-xl font-semibold text-sky-400 border-b-2 border-sky-400/30 pb-2 mb-6">Data & Cache</h3>
            <div class="space-y-6">
              <!-- Clear Image Cache -->
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                <div>
                  <label class="text-gray-300">Clear Image Cache</label>
                  <p class="text-xs text-gray-500 mt-1">Removes all downloaded channel logos and VOD posters. They will be re-downloaded as needed.</p>
                </div>
                <div class="md:col-span-2">
                  <button type="button" (click)="onClearImageCache()" class="px-4 py-2 rounded-lg text-sm font-semibold bg-gray-700 hover:bg-gray-600">Clear Cache</button>
                </div>
              </div>
              <!-- Clear EPG Cache -->
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                <div>
                  <label class="text-gray-300">Clear EPG Cache</label>
                  <p class="text-xs text-gray-500 mt-1">Forces a complete re-download of all program guide data on the next refresh.</p>
                </div>
                <div class="md:col-span-2">
                  <button type="button" (click)="onClearEpgCache()" class="px-4 py-2 rounded-lg text-sm font-semibold bg-gray-700 hover:bg-gray-600">Clear Cache</button>
                </div>
              </div>
              <!-- Export/Import -->
              <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                <div>
                  <label class="text-gray-300">Backup & Restore</label>
                  <p class="text-xs text-gray-500 mt-1">Save or load all your playlists, favorites, and settings to a local file.</p>
                </div>
                <div class="md:col-span-2 flex items-center gap-3">
                  <button type="button" (click)="onExportData()" class="px-4 py-2 rounded-lg text-sm font-semibold bg-sky-600 text-white hover:bg-sky-500">Export</button>
                  <button type="button" (click)="onImportData()" class="px-4 py-2 rounded-lg text-sm font-semibold bg-gray-700 hover:bg-gray-600">Import</button>
                </div>
              </div>
            </div>
          </section>
        </form>
      </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsComponent {
  settingsService = inject(SettingsService);
  notificationService = inject(NotificationService);
  tauriService = inject(TauriService);
  iptvService = inject(IptvService);
  
  timeOffsetOptions: { value: number; label: string }[] = [];

  // Fix: Strongly type the form controls and make them non-nullable to match the AppSettings interface.
  settingsForm = new FormGroup({
    defaultView: new FormControl<AppSettings['defaultView']>('live-tv', { nonNullable: true }),
    refreshOnStart: new FormControl(true, { nonNullable: true }),
    minimizeToTray: new FormControl(false, { nonNullable: true }),
    exitToTray: new FormControl(false, { nonNullable: true }),
    mpvParams: new FormControl('', { nonNullable: true }),
    startVolume: new FormControl(100, { nonNullable: true }),
    hwAccel: new FormControl(true, { nonNullable: true }),
    bufferSize: new FormControl<'off' | 'small' | 'medium' | 'large'>('medium', { nonNullable: true }),
    epgTimeOffset: new FormControl(0, { nonNullable: true }),
    epgRefreshFrequency: new FormControl(12, { nonNullable: true }),
  });

  constructor() {
    this.generateTimeOffsetOptions();
    // Populate form with initial values from the service
    const currentSettings = this.settingsService.getSettings();
    this.settingsForm.patchValue(currentSettings, { emitEvent: false });

    // Listen for form changes and update the service
    this.settingsForm.valueChanges.pipe(debounceTime(300)).subscribe(values => {
      this.settingsService.updateSettings(values);
    });
  }

  private _getErrorMessage(error: unknown): string {
    if (typeof error === 'string') {
      return error;
    }
    if (error instanceof Error) {
      return error.message;
    }
    if (error && typeof error === 'object' && 'message' in error && typeof (error as { message: unknown }).message === 'string') {
      return (error as { message: string }).message;
    }
    return 'An unknown error occurred.';
  }

  private generateTimeOffsetOptions(): void {
    const options: { value: number; label: string }[] = [];
    for (let minutes = -720; minutes <= 720; minutes += 30) {
      if (minutes === 0) {
        options.push({ value: 0, label: 'None (UTC)' });
        continue;
      }
      const hours = Math.floor(Math.abs(minutes) / 60);
      const mins = Math.abs(minutes) % 60;
      const sign = minutes > 0 ? '+' : '-';
      const label = `${sign}${hours}h ${mins > 0 ? `${mins}m` : ''}`.trim();
      options.push({ value: minutes, label });
    }
    this.timeOffsetOptions = options;
  }

  async onClearImageCache(): Promise<void> {
    if (confirm('Are you sure you want to clear all cached images? This cannot be undone.')) {
        try {
            await this.tauriService.invoke('clear_image_cache');
            this.notificationService.show('Image cache cleared successfully.', 'success');
        } catch (err) {
            console.error("Failed to clear image cache:", err);
            const errorMessage = this._getErrorMessage(err);
            this.notificationService.show(`Error clearing image cache: ${errorMessage}`, 'error');
        }
    }
  }

  async onClearEpgCache(): Promise<void> {
    if (confirm('Are you sure you want to clear the EPG cache? Guide data will be re-downloaded.')) {
        try {
            await this.tauriService.invoke('clear_epg_cache');
            this.notificationService.show('EPG cache cleared. Refreshing on next cycle.', 'success');
        } catch (err) {
            console.error("Failed to clear EPG cache:", err);
            const errorMessage = this._getErrorMessage(err);
            this.notificationService.show(`Error clearing EPG cache: ${errorMessage}`, 'error');
        }
    }
  }

  async onExportData(): Promise<void> {
    try {
        await this.tauriService.invoke('export_user_data');
        this.notificationService.show('User data exported successfully.', 'success');
    } catch (err) {
        console.error("Failed to export data:", err);
        const errorMessage = this._getErrorMessage(err);
        if (!errorMessage.toLowerCase().includes('cancelled')) {
            this.notificationService.show(`Error exporting data: ${errorMessage}`, 'error');
        }
    }
  }

  async onImportData(): Promise<void> {
    if (confirm('Importing data will overwrite your current settings and playlists. Are you sure?')) {
        try {
            await this.tauriService.invoke('import_user_data');
            this.notificationService.show('Import successful! Reloading application...', 'success');
            // Re-initialize the app to load the new data
            await this.iptvService.init();
        } catch (err) {
            console.error("Failed to import data:", err);
            const errorMessage = this._getErrorMessage(err);
            if (!errorMessage.toLowerCase().includes('cancelled')) {
                this.notificationService.show(`Error importing data: ${errorMessage}`, 'error');
            }
        }
    }
  }
}