import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Settings } from './window';
import { Folder, Screenshot } from './models';

function relativeDate(dateStr: string): string {
  const now = new Date();
  const folderDate = new Date(`${dateStr}T00:00:00.000Z`);
  const diffMs = now.getTime() - folderDate.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.round(diffDays / 7)} weeks ago`;
  if (diffDays < 365) return `${Math.round(diffDays / 30)} months ago`;
  return `${Math.round(diffDays / 365)} years ago`;
}

function escapeHtml(value: string): string {
  const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(value).replace(/[&<>"']/g, (character: string) => map[character] || character);
}

function bytes(value: number): string {
  return value < 1024 * 1024 
    ? `${Math.max(1, Math.round(value / 1024))} KB` 
    : `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function changed(value: number): string {
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  settings = signal<Settings>({ sourceDir: '', destinationDir: '', settleSeconds: 2, startIntervalSeconds: 10 });
  statusText = signal<string>('');
  folders = signal<Folder[]>([]);
  error = signal<string>('');
  selectedTab = signal<'library' | 'settings'>('library');
  collapsedFolders = signal<Set<string>>(new Set());

  async ngOnInit() {
    await this.loadSettings();
    await this.refreshStatus();
    await this.loadLibrary();
  }

  async loadSettings() {
    try {
      const settings = await window.screenshotSorter.settings();
      this.settings.set(settings);
    } catch (e: any) {
      this.error.set(String(e?.message ?? e));
    }
  }

  async refreshStatus() {
    try {
      const status = await window.screenshotSorter.status();
      this.statusText.set(status);
    } catch (e: any) {
      this.statusText.set(`Error: ${String(e?.message ?? e)}`);
    }
  }

  async loadLibrary() {
    this.folders.set([]);
    try {
      const folders = await window.screenshotSorter.library();
      this.folders.set(folders);
    } catch (e: any) {
      this.folders.set([]);
    }
  }

  selectTab(tab: 'library' | 'settings') {
    this.selectedTab.set(tab);
    if (tab === 'library') {
      this.loadLibrary();
    }
  }

  async chooseFolder(id: string) {
    try {
      const current = this.settings()[id === 'source' ? 'sourceDir' : 'destinationDir'] || '';
      const folder = await window.screenshotSorter.chooseFolder(current);
      if (folder) {
        this.settings.update((s: Settings) => ({
          ...s,
          [id === 'source' ? 'sourceDir' : 'destinationDir']: folder
        }));
      }
    } catch (e: any) {
      this.error.set(String(e?.message ?? e));
    }
  }

  async saveSettings() {
    try {
      const result = await window.screenshotSorter.save(this.settings());
      this.statusText.set(result.output);
      await this.loadSettings();
    } catch (e: any) {
      this.error.set(`Save failed: ${String(e?.message ?? e)}`);
    }
  }

  toggleFolder(date: string, event: Event) {
    event.stopPropagation();
    this.collapsedFolders.update((set: Set<string>) => {
      const newSet = new Set(set);
      if (newSet.has(date)) {
        newSet.delete(date);
      } else {
        newSet.add(date);
      }
      return newSet;
    });
  }

  // Helper methods for template
  relativeDate(dateStr: string): string {
    const now = new Date();
    const folderDate = new Date(`${dateStr}T00:00:00.000Z`);
    const diffMs = now.getTime() - folderDate.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.round(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.round(diffDays / 30)} months ago`;
    return `${Math.round(diffDays / 365)} years ago`;
  }

  escapeHtml(value: string): string {
    const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return String(value).replace(/[&<>"']/g, (character: string) => map[character] || character);
  }

  bytes(value: number): string {
    return value < 1024 * 1024 
      ? `${Math.max(1, Math.round(value / 1024))} KB` 
      : `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }

  changed(value: number): string {
    return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  }

  thumbnail(id: string): string {
    return '';
  }
}
