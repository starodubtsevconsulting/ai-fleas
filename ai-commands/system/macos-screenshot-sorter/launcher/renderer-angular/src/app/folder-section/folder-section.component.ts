import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Screenshot } from '../models';

@Component({
  selector: 'app-folder-section',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './folder-section.component.html',
  styleUrl: './folder-section.component.css',
})
export class FolderSectionComponent {
  @Input() date!: string;
  @Input() count!: number;
  @Input() screenshots: Screenshot[] = [];
  @Input() collapsed: boolean = false;
  @Output() toggle = new EventEmitter<void>();
  @Output() openFolder = new EventEmitter<Screenshot>();
  @Output() openScreenshot = new EventEmitter<Screenshot>();

  toggleFolder(event: Event) {
    event.stopPropagation();
    this.toggle.emit();
  }

  formatBytes(bytes: number): string {
    return bytes < 1024 * 1024 
      ? `${Math.max(1, Math.round(bytes / 1024))} KB` 
      : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  formatModified(date: number): string {
    return new Date(date).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  }

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
}
