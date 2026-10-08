import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, HostListener, HostBinding } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Screenshot } from '../models';
import { ScreenshotSorterService } from '../screenshot-sorter.service';

@Component({
  selector: 'app-screenshot-detail',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './screenshot-detail.component.html',
  styleUrl: './screenshot-detail.component.css',
})
export class ScreenshotDetailComponent implements OnInit, OnChanges {
  @Input() shot: Screenshot | null = null;
  @Output() close = new EventEmitter<void>();

  fullImageUrl: string = '';
  thumbnailUrl: string = '';
  constructor(private service: ScreenshotSorterService) {}

  ngOnInit() {
    this.loadImage();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['shot']) {
      this.loadImage();
     }
  }

  async loadImage() {
    if (this.shot) {
      try {
        this.fullImageUrl = await this.service.fullImage(this.shot.id) || '';
        this.thumbnailUrl = this.fullImageUrl;
      } catch (e: any) {
        console.error('Failed to load full image:', e);
        this.fullImageUrl = '';
        this.thumbnailUrl = '';
      }
    } else {
      this.fullImageUrl = '';
      this.thumbnailUrl = '';
    }
  }

  closeScreenshot() {
    this.close.emit();
  }

  formatBytes(bytes: number): string {
    return bytes < 1024 * 1024 
      ? `${Math.max(1, Math.round(bytes / 1024))} KB` 
      : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  @HostBinding('style.display')
  get displayStyle() {
    return this.shot ? 'flex' : 'none';
  }
}
