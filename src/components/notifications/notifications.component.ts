import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-3">
      @for (notification of notificationService.notifications(); track notification.id) {
        <div 
          class="flex items-center justify-between w-full max-w-sm p-4 text-gray-100 bg-gray-800 rounded-lg shadow-lg border-l-4 ring-1 ring-white/10"
          [class]="{
            'border-green-400 shadow-green-400/20': notification.type === 'success',
            'border-red-400 shadow-red-400/20': notification.type === 'error',
            'border-sky-400 shadow-sky-400/20': notification.type === 'info'
          }"
          role="alert"
          >
          <div class="flex items-center">
            @if(notification.type === 'success') {
              <svg class="w-5 h-5 mr-3 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clip-rule="evenodd" /></svg>
            } @else if (notification.type === 'error') {
              <svg class="w-5 h-5 mr-3 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM8.28 7.22a.75.75 0 0 0-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 1 0 1.06 1.06L10 11.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L11.06 10l1.72-1.72a.75.75 0 0 0-1.06-1.06L10 8.94 8.28 7.22Z" clip-rule="evenodd" /></svg>
            } @else {
              <!-- No icon for info notifications -->
            }
            <div class="text-sm font-medium">{{ notification.message }}</div>
          </div>
          <button type="button" (click)="notificationService.remove(notification.id)" class="-mx-1.5 -my-1.5 ml-3 p-1.5 inline-flex items-center justify-center h-8 w-8 text-gray-400 hover:text-gray-100 hover:bg-gray-700 rounded-lg focus:ring-2 focus:ring-gray-300" aria-label="Close">
            <span class="sr-only">Close</span>
            <svg class="w-3 h-3" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 14">
              <path stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6"/>
            </svg>
          </button>
        </div>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationsComponent {
  notificationService = inject(NotificationService);
}