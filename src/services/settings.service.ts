import { Injectable, signal, inject } from '@angular/core';
import { TauriService } from './tauri.service';

export interface AppSettings {
  defaultView: 'live-tv' | 'movies' | 'series' | 'favorites' | 'recently-watched';
  refreshOnStart: boolean;
  minimizeToTray: boolean;
  exitToTray: boolean;
  mpvParams: string;
  startVolume: number;
  hwAccel: boolean;
  bufferSize: 'off' | 'small' | 'medium' | 'large';
  epgTimeOffset: number; // in minutes
  epgRefreshFrequency: number; // in hours
}

@Injectable({
  providedIn: 'root',
})
export class SettingsService {
  private tauriService = inject(TauriService);

  private readonly defaultSettings: AppSettings = {
    defaultView: 'live-tv',
    refreshOnStart: true,
    minimizeToTray: false,
    exitToTray: false,
    mpvParams: '--hwdec=auto',
    startVolume: 100,
    hwAccel: true,
    bufferSize: 'medium',
    epgTimeOffset: 0,
    epgRefreshFrequency: 12,
  };

  readonly settings = signal<AppSettings>(this.defaultSettings);

  constructor() {
    // Loading is now handled via an explicit async method
    // to be called during app initialization.
  }

  async loadSettings(): Promise<void> {
    try {
      const saved = await this.tauriService.invoke<AppSettings | null>('get_settings');
      if (saved) {
        this.settings.set(saved);
      } else {
        // If no settings are saved yet, initialize them with defaults
        this.settings.set(this.defaultSettings);
        await this.saveSettings(this.defaultSettings);
      }
    } catch (e) {
      console.error('Failed to load settings from backend, using defaults.', e);
      this.settings.set(this.defaultSettings);
    }
  }

  private async saveSettings(settings: AppSettings): Promise<void> {
    try {
      await this.tauriService.invoke('save_settings', { settings });
    } catch (e) {
      console.error('Failed to save settings to backend.', e);
    }
  }

  getSettings(): AppSettings {
    return this.settings();
  }

  updateSettings(newSettings: Partial<AppSettings>): void {
    this.settings.update(current => {
      const updated = { ...current, ...newSettings };
      this.saveSettings(updated);
      return updated;
    });
  }
}
