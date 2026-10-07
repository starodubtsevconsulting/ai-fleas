import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Folder, Screenshot, Settings } from './models';

@Injectable({
  providedIn: 'root'
})
export class ScreenshotSorterService {
  settings(): Promise<Settings> {
    return window.screenshotSorter.settings();
  }

  status(): Promise<string> {
    return window.screenshotSorter.status();
  }

  library(): Promise<Folder[]> {
    return window.screenshotSorter.library();
  }

  chooseFolder(current: string): Promise<string | null> {
    return window.screenshotSorter.chooseFolder(current);
  }

  save(settings: Settings): Promise<{ output: string }> {
    return window.screenshotSorter.save(settings);
  }

  thumbnail(id: string): Promise<string | null> {
    return window.screenshotSorter.thumbnail(id);
  }

  fullImage(id: string): Promise<string | null> {
    return window.screenshotSorter.fullImage(id);
  }

  openFolder(folderPath: string): Promise<void> {
    return window.screenshotSorter.openFolder(folderPath);
  }
}
