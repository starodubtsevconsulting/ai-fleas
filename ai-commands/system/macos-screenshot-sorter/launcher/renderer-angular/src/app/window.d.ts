import { Folder, Screenshot } from './models';

export interface Settings {
  sourceDir: string;
  destinationDir: string;
  settleSeconds: number;
  startIntervalSeconds: number;
}

export interface ScreenshotSorter {
  settings(): Promise<Settings>;
  status(): Promise<string>;
  library(): Promise<Folder[]>;
  chooseFolder(current: string): Promise<string | null>;
  save(settings: Settings): Promise<{ output: string }>;
  thumbnail(id: string): Promise<string | null>;
}

declare global {
  interface Window {
    screenshotSorter: ScreenshotSorter;
  }
}
