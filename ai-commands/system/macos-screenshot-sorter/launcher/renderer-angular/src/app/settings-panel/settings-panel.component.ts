import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Settings } from '../models';

@Component({
  selector: 'app-settings-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './settings-panel.component.html',
  styleUrl: './settings-panel.component.css',
})
export class SettingsPanelComponent {
  @Input() settings!: Settings;
  @Input() statusText!: string;
  @Input() error!: string;
  @Output() chooseFolder = new EventEmitter<'source' | 'destination'>();
  @Output() saveSettings = new EventEmitter<void>();
  @Output() refreshStatus = new EventEmitter<void>();

  chooseFolderAction(id: 'source' | 'destination') {
    this.chooseFolder.emit(id);
  }

  saveSettingsAction() {
    this.saveSettings.emit();
  }

  refreshStatusAction() {
    this.refreshStatus.emit();
  }
}
