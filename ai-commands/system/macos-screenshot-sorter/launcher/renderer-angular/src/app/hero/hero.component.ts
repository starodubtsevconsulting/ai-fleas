import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-hero',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './hero.component.html',
  styleUrl: './hero.component.css',
})
export class HeroComponent {
  @Output() close = new EventEmitter<void>();
  showHero: boolean = true;

  hideHero() {
    this.showHero = false;
    this.close.emit();
  }
}
