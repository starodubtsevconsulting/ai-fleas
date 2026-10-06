import { Injectable } from '@angular/core';
import { Folder, Screenshot } from './models';
import { Settings } from './window';

@Injectable({
  providedIn: 'root'
})
export class ScreenshotSorterService {
  async settings(): Promise<Settings> {
    return window.screenshotSorter.settings();
  }

  async status(): Promise<string> {
    return window.screenshotSorter.status();
  }

  async library(): Promise<Folder[]> {
    return window.screenshotSorter.library();
  }

  async chooseFolder(current: string): Promise<string | null> {
    return window.screenshotSorter.chooseFolder(current);
  }

  async save(settings: Settings): Promise<{ output: string }> {
    return window.screenshotSorter.save(settings);
  }

  async thumbnail(id: string): Promise<string | null> {
    return window.screenshotSorter.thumbnail(id);
  }
}
