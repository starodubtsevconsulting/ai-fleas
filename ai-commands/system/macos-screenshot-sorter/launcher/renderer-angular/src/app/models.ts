export interface Screenshot {
  id: string;
  name: string;
  modifiedAt: number;
  bytes: number;
}

export interface Folder {
  date: string;
  count: number;
  screenshots: Screenshot[];
}
