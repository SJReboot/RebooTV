import { Injectable, NgZone } from '@angular/core';
import { invoke } from '@tauri-apps/api/core';
import { listen, EventCallback, UnlistenFn } from '@tauri-apps/api/event';

@Injectable({
  providedIn: 'root',
})
export class TauriService {
  constructor(private ngZone: NgZone) {}

  isTauriAvailable(): boolean {
    return !!(window as any).__TAURI__;
  }

  async invoke<T>(cmd: string, args?: any): Promise<T> {
    if (!this.isTauriAvailable()) {
        console.warn(`Tauri API not available. Command '${cmd}' was not sent.`);
        // Return a resolved promise with a default value to prevent app crashes
        return Promise.resolve(undefined as T);
    }
    return invoke(cmd, args);
  }

  async listen<T>(event: string, handler: EventCallback<T>): Promise<UnlistenFn> {
    if (!this.isTauriAvailable()) {
        console.warn(`Tauri API not available. Listener for '${event}' was not attached.`);
        // Return a no-op unlisten function
        return () => {};
    }

    // Wrap the handler in NgZone.run to ensure Angular change detection runs
    const zonedHandler: EventCallback<T> = (eventPayload) => {
      this.ngZone.run(() => {
        handler(eventPayload);
      });
    };

    return await listen(event, zonedHandler);
  }

  /**
   * Launches the MPV sidecar player with the given stream URL.
   * Rust backend handles arguments like fullscreen (--fs).
   */
  async playStream(url: string): Promise<void> {
    return this.invoke('play_stream', { url });
  }

  async scheduleNotification(title: string, body: string, scheduleAt: number): Promise<void> {
    return this.invoke('schedule_notification', { title, body, scheduleAt });
  }
}