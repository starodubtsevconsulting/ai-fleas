import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-library-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './library-header.component.html',
  styleUrl: './library-header.component.css',
})
export class LibraryHeaderComponent {
  @Output() refresh = new EventEmitter<void>();

  refreshScreenshots() {
    this.refresh.emit();
  }
}
