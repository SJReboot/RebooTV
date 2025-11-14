import { Injectable, signal } from '@angular/core';

export interface Notification {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  readonly notifications = signal<Notification[]>([]);
  private nextId = 0;

  show(message: string, type: 'success' | 'error' | 'info' = 'info', duration = 5000): void {
    const id = this.nextId++;
    const newNotification: Notification = { id, message, type };

    this.notifications.update(current => [...current, newNotification]);

    if (duration > 0) {
      setTimeout(() => this.remove(id), duration);
    }
  }

  remove(id: number): void {
    this.notifications.update(current => current.filter(n => n.id !== id));
  }
}
