import { Component, EventEmitter, Output } from '@angular/core';

@Component({
  selector: 'app-hero',
  standalone: true,
  imports: [],
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
