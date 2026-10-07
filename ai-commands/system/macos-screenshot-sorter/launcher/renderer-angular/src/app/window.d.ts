import { Settings, Folder, Screenshot } from './models';

export interface ScreenshotSorter {
  settings: () => Promise<Settings>;
  status: () => Promise<string>;
  library: () => Promise<Folder[]>;
  chooseFolder: (current: string) => Promise<string | null>;
  save: (settings: Settings) => Promise<{ output: string }>;
  thumbnail: (id: string) => Promise<string | null>;
  fullImage: (id: string) => Promise<string | null>;
  openFolder: (folderPath: string) => Promise<void>;
}

declare global {
  interface Window {
    screenshotSorter: ScreenshotSorter;
  }
}

export {};
