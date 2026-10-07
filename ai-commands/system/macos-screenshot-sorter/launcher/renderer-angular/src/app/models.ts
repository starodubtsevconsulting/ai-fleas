export interface Settings {
  sourceDir: string;
  destinationDir: string;
  settleSeconds: number;
  startIntervalSeconds: number;
}

export interface Screenshot {
  id: string;
  name: string;
  modifiedAt: number;
  bytes: number;
  folderPath: string;
}

export interface Folder {
  date: string;
  count: number;
  screenshots: Screenshot[];
}
