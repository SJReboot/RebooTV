import { Component, ChangeDetectionStrategy, input, output, effect, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Playlist } from '../../models/iptv.models';
import { FormGroup, FormControl, Validators, ReactiveFormsModule } from '@angular/forms';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-playlist-card',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="h-full flex flex-col bg-gray-800/50 rounded-lg p-6">
      <h2 class="text-2xl font-bold text-gray-200 mb-6">{{ isAdding() ? 'Add New Playlist' : 'Edit Playlist' }}</h2>
      <form [formGroup]="playlistForm" (ngSubmit)="onSave()" class="flex flex-col flex-1">
        <div class="space-y-4 flex-1 overflow-y-auto pr-2">
          <div>
            <label for="name-{{uniqueId}}" class="block mb-2 text-sm font-medium text-gray-300">Playlist Name</label>
            <input type="text" id="name-{{uniqueId}}" formControlName="name" class="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-sky-500 focus:border-sky-500 block w-full p-2.5" placeholder="e.g., My IPTV Provider">
          </div>
          <div>
            <label for="type-{{uniqueId}}" class="block mb-2 text-sm font-medium text-gray-300">Playlist Type</label>
            <select id="type-{{uniqueId}}" formControlName="type" class="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-sky-500 focus:border-sky-500 block w-full p-2.5">
              <option value="xtream">Xtream Codes</option>
              <option value="m3u">M3U URL</option>
              <option value="stalker">Stalker Portal</option>
            </select>
          </div>
          <div>
            <label for="url-{{uniqueId}}" class="block mb-2 text-sm font-medium text-gray-300">URL</label>
            <input type="text" id="url-{{uniqueId}}" formControlName="url" class="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-sky-500 focus:border-sky-500 block w-full p-2.5" [placeholder]="urlPlaceholder()">
          </div>
            @if (playlistForm.get('type')?.value === 'xtream') {
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label for="username-{{uniqueId}}" class="block mb-2 text-sm font-medium text-gray-300">Username</label>
                    <input type="text" id="username-{{uniqueId}}" formControlName="username" class="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-sky-500 focus:border-sky-500 block w-full p-2.5">
                </div>
                <div>
                    <label for="password-{{uniqueId}}" class="block mb-2 text-sm font-medium text-gray-300">Password</label>
                    <input type="password" id="password-{{uniqueId}}" formControlName="password" class="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-sky-500 focus:border-sky-500 block w-full p-2.5">
                </div>
            </div>
          }
            @if (playlistForm.get('type')?.value === 'stalker') {
              <div>
                <label for="macAddress-{{uniqueId}}" class="block mb-2 text-sm font-medium text-gray-300">MAC Address</label>
                <input type="text" id="macAddress-{{uniqueId}}" formControlName="macAddress" class="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-sky-500 focus:border-sky-500 block w-full p-2.5" placeholder="00:1A:79:XX:XX:XX">
            </div>
          }
        </div>
        <div class="flex justify-end gap-3 mt-6 flex-shrink-0">
          <button type="button" (click)="onCancel()" class="px-4 py-2 rounded-lg text-sm font-semibold bg-gray-600 hover:bg-gray-500">Cancel</button>
          <button type="submit" [disabled]="playlistForm.invalid" class="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-sky-600 hover:bg-sky-700 transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed">
            {{ isAdding() ? 'Add Playlist' : 'Save Changes' }}
          </button>
        </div>
      </form>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlaylistCardComponent {
  notificationService = inject(NotificationService);

  // --- Inputs ---
  playlist = input<Playlist | null>(null);
  isAdding = input(false);
  isEditing = input(false);

  // --- Outputs ---
  add = output<Omit<Playlist, 'id' | 'status' | 'isActive'>>();
  save = output<Playlist>();
  cancel = output<void>();

  // --- Internal State ---
  uniqueId = Math.random().toString(36).substring(2);

  playlistForm = new FormGroup({
    id: new FormControl<number | null>(null),
    name: new FormControl('', [Validators.required]),
    url: new FormControl('', [Validators.required, Validators.pattern('https?://.+')]),
    type: new FormControl<'xtream' | 'm3u' | 'stalker'>('xtream', [Validators.required]),
    username: new FormControl(''),
    password: new FormControl(''),
    macAddress: new FormControl(''),
  });

  urlPlaceholder = computed(() => {
    switch (this.playlistForm.get('type')?.value) {
      case 'xtream': return 'http://server:port';
      case 'm3u': return 'http://server/playlist.m3u8';
      case 'stalker': return 'http://server/c/';
      default: return 'http://...';
    }
  });

  constructor() {
    effect(() => {
      this.initializeForm(this.playlist());
    });

    effect(() => {
      const typeControl = this.playlistForm.get('type');
      if (!typeControl) return;
      const type = typeControl.value;
      const usernameControl = this.playlistForm.get('username');
      const passwordControl = this.playlistForm.get('password');
      const macAddressControl = this.playlistForm.get('macAddress');
      if (!usernameControl || !passwordControl || !macAddressControl) return;

      Promise.resolve().then(() => {
        if (type === 'xtream') {
          usernameControl.setValidators([Validators.required]);
          passwordControl.setValidators([Validators.required]);
          macAddressControl.clearValidators();
        } else if (type === 'stalker') {
          usernameControl.clearValidators();
          passwordControl.clearValidators();
          macAddressControl.setValidators([Validators.required, Validators.pattern(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/)]);
        } else { // m3u
          usernameControl.clearValidators();
          passwordControl.clearValidators();
          macAddressControl.clearValidators();
        }
        usernameControl.updateValueAndValidity({ emitEvent: false });
        passwordControl.updateValueAndValidity({ emitEvent: false });
        macAddressControl.updateValueAndValidity({ emitEvent: false });
      });
    }, { allowSignalWrites: true });
  }

  initializeForm(p: Playlist | null): void {
    if (this.isEditing() && p) {
      this.playlistForm.reset({
        id: p.id, name: p.name, url: p.url, type: p.type,
        username: p.username ?? '', password: '', macAddress: p.macAddress ?? ''
      });
    } else {
      this.playlistForm.reset({
        id: null, name: '', url: '', type: 'xtream',
        username: '', password: '', macAddress: ''
      });
    }
  }

  onSave(): void {
    if (this.playlistForm.invalid) {
      this.notificationService.show('Please fill out all required fields.', 'error');
      this.playlistForm.markAllAsTouched();
      return;
    }
    const formValue = this.playlistForm.value;
    if (this.isAdding()) {
      const { id, ...newPlaylistData } = formValue;
      this.add.emit(newPlaylistData as Omit<Playlist, 'id' | 'status' | 'isActive'>);
    } else {
      const originalPlaylist = this.playlist();
      if (!originalPlaylist) return;
      
      const updatedPlaylist: Playlist = {
        ...originalPlaylist,
        name: formValue.name!, url: formValue.url!, type: formValue.type!,
        username: formValue.username || undefined, macAddress: formValue.macAddress || undefined,
      };
       // Only include password if it has been changed
      if (formValue.password) {
        updatedPlaylist.password = formValue.password;
      }
      
      this.save.emit(updatedPlaylist);
    }
  }

  onCancel(): void {
    this.cancel.emit();
  }
}
