import { Component, EventEmitter, Output } from '@angular/core';

@Component({
  selector: 'app-library-header',
  standalone: true,
  imports: [],
  templateUrl: './library-header.component.html',
  styleUrl: './library-header.component.css',
})
export class LibraryHeaderComponent {
  @Output() refresh = new EventEmitter<void>();

  refreshScreenshots() {
    this.refresh.emit();
  }
}
