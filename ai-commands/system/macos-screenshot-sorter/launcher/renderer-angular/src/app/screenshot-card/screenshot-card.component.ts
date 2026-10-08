import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-screenshot-card',
  standalone: true,
  imports: [],
  templateUrl: './screenshot-card.component.html',
  styleUrl: './screenshot-card.component.css',
})
export class ScreenshotCardComponent {
  @Input() shot: any = null;
  @Input() thumbnail: string = '';
  @Output() openFolder = new EventEmitter<void>();
  @Output() openScreenshot = new EventEmitter<void>();

  formatBytes(bytes: number): string {
    return bytes < 1024 * 1024 
      ? `${Math.max(1, Math.round(bytes / 1024))} KB` 
      : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  formatModified(date: number): string {
    return new Date(date).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  }
}
