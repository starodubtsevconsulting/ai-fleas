import { Component, EventEmitter, Output } from '@angular/core';

export type Tab = 'library' | 'settings';

@Component({
  selector: 'app-tabs',
  standalone: true,
  imports: [],
  templateUrl: './tabs.component.html',
  styleUrl: './tabs.component.css',
})
export class TabsComponent {
  @Output() tabChange = new EventEmitter<Tab>();

  selectedTab: Tab = 'library';

  selectTab(tab: Tab) {
    this.selectedTab = tab;
    this.tabChange.emit(tab);
  }
}
