import { Component, Input, Output, EventEmitter, OnInit, OnChanges, SimpleChanges, HostListener, HostBinding, AfterViewInit, OnDestroy } from '@angular/core';
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
export class ScreenshotDetailComponent implements OnInit, OnChanges, AfterViewInit, OnDestroy {
  @Input() shot: Screenshot | null = null;
  @Output() close = new EventEmitter<void>();

  fullImageUrl: string = '';
  thumbnailUrl: string = '';
  private globalEscHandler: (() => void) | null = null;
  private globalKeydownHandler: ((event: KeyboardEvent) => void) | null = null;

  constructor(private service: ScreenshotSorterService) {}

  ngOnInit() {
    this.loadImage();
  }

  ngAfterViewInit() {
    // Set up custom event listener for Electron ESC forwarding
    this.globalEscHandler = () => this.closeScreenshot();
    window.addEventListener('escape-key-pressed', this.globalEscHandler);
    
    // Set up window-level keydown handler as a fallback
    this.globalKeydownHandler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        this.closeScreenshot();
      }
    };
    window.addEventListener('keydown', this.globalKeydownHandler);
  }

  ngOnDestroy() {
    // Clean up global listeners
    if (this.globalEscHandler) {
      window.removeEventListener('escape-key-pressed', this.globalEscHandler);
      this.globalEscHandler = null;
    }
    if (this.globalKeydownHandler) {
      window.removeEventListener('keydown', this.globalKeydownHandler);
      this.globalKeydownHandler = null;
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['shot']) {
      this.loadImage();
      // Auto-focus the overlay when the screenshot is selected
      setTimeout(() => this.focusOverlay(), 0);
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

  focusOverlay() {
    // Focus the overlay div for keyboard events
    const overlay = document.querySelector('app-screenshot-detail .full-screen-overlay');
    if (overlay) {
      (overlay as HTMLElement).focus();
    }
  }

  handleKeyDown(event: KeyboardEvent) {
    // Handle keydown on the overlay itself (for ESC key)
    if (event.key === 'Escape') {
      this.closeScreenshot();
    }
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
