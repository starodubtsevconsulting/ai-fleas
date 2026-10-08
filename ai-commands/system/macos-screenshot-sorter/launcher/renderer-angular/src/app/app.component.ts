import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DatePipe } from '@angular/common';
import { Settings, Folder, Screenshot } from './models';
import { ScreenshotSorterService } from './screenshot-sorter.service';
import { ScreenshotDetailComponent } from './screenshot-detail/screenshot-detail.component';
import { TabsComponent, Tab } from './tabs/tabs.component';
import { HeroComponent } from './hero/hero.component';
import { LibraryHeaderComponent } from './library-header/library-header.component';
import { FolderSectionComponent } from './folder-section/folder-section.component';
import { SettingsPanelComponent } from './settings-panel/settings-panel.component';

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
  imports: [
    CommonModule,
    DatePipe,
    ScreenshotDetailComponent,
    TabsComponent,
    HeroComponent,
    LibraryHeaderComponent,
    FolderSectionComponent,
    SettingsPanelComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
  settings: Settings = { sourceDir: '', destinationDir: '', settleSeconds: 2, startIntervalSeconds: 10 };
  statusText: string = '';
  folders: Folder[] = [];
  error: string = '';
  selectedTab: Tab = 'library';
  collapsedFolders: Set<string> = new Set();
  thumbnailCache: Map<string, string> = new Map();
  selectedScreenshot: Screenshot | null = null;

  constructor(private service: ScreenshotSorterService) {}

  async ngOnInit() {
    await this.loadSettings();
    await this.refreshStatus();
    await this.loadLibrary();
  }

  async loadSettings() {
    try {
      this.settings = await window.screenshotSorter.settings();
    } catch (e: any) {
      this.error = String(e?.message ?? e);
    }
  }

  async refreshStatus() {
    try {
      this.statusText = await window.screenshotSorter.status();
    } catch (e: any) {
      this.statusText = `Error: ${String(e?.message ?? e)}`;
    }
  }

  async loadLibrary() {
    this.folders = [];
    try {
      this.folders = await window.screenshotSorter.library();
      this.folders.forEach(folder => {
        folder.screenshots.forEach(shot => {
          if (!this.thumbnailCache.has(shot.id)) {
            this.loadThumbnail(shot);
          }
        });
      });
    } catch (e: any) {
      this.folders = [];
    }
  }

  async loadThumbnail(shot: Screenshot) {
    try {
      const thumbnailUrl = await this.service.thumbnail(shot.id);
      if (thumbnailUrl) {
        this.thumbnailCache.set(shot.id, thumbnailUrl);
      }
    } catch (e: any) {
      // Silently fail - thumbnail will show as unavailable
    }
  }

  selectTab(tab: Tab) {
    this.selectedTab = tab;
    if (tab === 'library') {
      this.loadLibrary();
    }
  }

  async chooseFolder(id: 'source' | 'destination') {
    try {
      const current = this.settings[id === 'source' ? 'sourceDir' : 'destinationDir'] || '';
      const folder = await window.screenshotSorter.chooseFolder(current);
      if (folder) {
        this.settings = {
          ...this.settings,
          [id === 'source' ? 'sourceDir' : 'destinationDir']: folder
        };
      }
    } catch (e: any) {
      this.error = String(e?.message ?? e);
    }
  }

  async saveSettings() {
    try {
      const result = await window.screenshotSorter.save(this.settings);
      this.statusText = result.output;
      await this.loadSettings();
    } catch (e: any) {
      this.error = `Save failed: ${String(e?.message ?? e)}`;
    }
  }

  toggleFolder(date: string, event: Event) {
    event.stopPropagation();
    if (this.collapsedFolders.has(date)) {
      this.collapsedFolders.delete(date);
    } else {
      this.collapsedFolders.add(date);
    }
  }

  relativeDate(dateStr: string): string {
    return relativeDate(dateStr);
  }

  bytes(value: number): string {
    return bytes(value);
  }

  changed(value: number): string {
    return changed(value);
  }

  thumbnail(shot: Screenshot): string {
    return this.thumbnailCache.get(shot.id) || '';
  }

  async fullImage(shot: Screenshot): Promise<string> {
    try {
      const url = await this.service.fullImage(shot.id);
      return url || '';
    } catch (e: any) {
      return '';
    }
  }

  async openFolder(shot: Screenshot) {
    try {
      await this.service.openFolder(shot.folderPath);
    } catch (e: any) {
      console.error('Failed to open folder:', e);
    }
  }

  openScreenshot(shot: Screenshot) {
    this.selectedScreenshot = shot;
  }

  closeScreenshot() {
    this.selectedScreenshot = null;
  }
}
