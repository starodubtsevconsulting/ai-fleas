import { CommonModule } from '../../../ai-launcher/apps/ui/src/app/angular-runtime/angular-common';
import { Component, EventEmitter, Input, Output } from '../../../ai-launcher/apps/ui/src/app/angular-runtime/angular-core';
import { FormsModule } from '../../../ai-launcher/apps/ui/src/app/angular-runtime/angular-forms';

export interface LyricsTimestampPanelContext {
  projectPath: string;
  lyricsFile: string;
  audioFile: string;
  timingHintsFile: string;
  outputPath: string;
}

@Component({
  selector: 'ai-lyrics-timestamp-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
<section class="lyrics-panel" [class.is-compact]="compact">
  <header class="lyrics-panel-header">
    <div>
      <h2>Lyrics Timestamp</h2>
      <p>{{ context.projectPath || 'No project selected' }}</p>
    </div>
    <div class="lyrics-panel-actions">
      <span>{{ status }}</span>
      <button type="button" (click)="run()">Run</button>
      <button type="button" (click)="save()">Save</button>
    </div>
  </header>

  <div class="lyrics-panel-grid">
    <aside class="lyrics-panel-controls">
      <label>
        <span>Lyrics file</span>
        <input [ngModel]="context.lyricsFile" (ngModelChange)="updateField('lyricsFile', $event)">
      </label>
      <label>
        <span>Audio file</span>
        <input [ngModel]="context.audioFile" (ngModelChange)="updateField('audioFile', $event)">
      </label>
      <label>
        <span>Timing hints file</span>
        <input [ngModel]="context.timingHintsFile" (ngModelChange)="updateField('timingHintsFile', $event)">
      </label>
      <label>
        <span>Output folder</span>
        <input [ngModel]="context.outputPath" (ngModelChange)="updateField('outputPath', $event)">
      </label>
      <audio *ngIf="context.audioFile" controls [src]="context.audioFile"></audio>
    </aside>

    <section class="lyrics-panel-results">
      <div class="lyrics-panel-tabs">
        <button type="button" [class.is-active]="activeTab === 'mapped'" (click)="activeTab = 'mapped'">Mapped lyrics</button>
        <button type="button" [class.is-active]="activeTab === 'raw'" (click)="activeTab = 'raw'">Raw JSON</button>
      </div>
      <div class="lyrics-timestamp-list" *ngIf="activeTab === 'mapped'; else rawJson">
        <div class="lyrics-timestamp-row is-head"><span>#</span><span>Start</span><span>End</span><span>Line</span></div>
        <div class="lyrics-timestamp-row" *ngFor="let line of sampleLines">
          <span>{{ line.index }}</span>
          <input [value]="line.start" aria-label="Start time">
          <input [value]="line.end" aria-label="End time">
          <strong>{{ line.text }}</strong>
        </div>
      </div>
      <ng-template #rawJson>
        <pre>{{ sampleLines | json }}</pre>
      </ng-template>
    </section>
  </div>
</section>

  `,
  styles: [`
:host {
  display: block;
  min-height: 0;
  color: #eef2f6;
}

.lyrics-panel {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  min-height: 0;
  height: 100%;
  background: #111820;
  border: 1px solid #26323d;
  border-radius: 8px;
  overflow: hidden;
}

.lyrics-panel-header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 14px;
  border-bottom: 1px solid #26323d;
  background: #151d25;
}

.lyrics-panel-header h2 {
  margin: 0;
  font-size: 15px;
  line-height: 1.2;
}

.lyrics-panel-header p {
  margin: 4px 0 0;
  max-width: 58vw;
  overflow: hidden;
  color: #93a4b4;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lyrics-panel-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}

.lyrics-panel-actions span {
  color: #9fb0c0;
  font-size: 12px;
}

button,
input {
  border: 1px solid #344454;
  border-radius: 6px;
  background: #18222c;
  color: #eef2f6;
  font: inherit;
}

button {
  min-height: 32px;
  padding: 0 11px;
  cursor: pointer;
}

button:hover,
button.is-active {
  border-color: #58a6ff;
  background: #12365a;
}

input {
  width: 100%;
  min-width: 0;
  height: 32px;
  padding: 5px 8px;
}

.lyrics-panel-grid {
  display: grid;
  grid-template-columns: minmax(260px, 340px) minmax(0, 1fr);
  min-height: 0;
}

.lyrics-panel-controls {
  display: grid;
  align-content: start;
  gap: 12px;
  min-width: 0;
  padding: 14px;
  border-right: 1px solid #26323d;
  background: #10171e;
}

label {
  display: grid;
  gap: 5px;
  min-width: 0;
}

label span {
  color: #9fb0c0;
  font-size: 12px;
}

audio {
  width: 100%;
}

.lyrics-panel-results {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  min-width: 0;
  min-height: 0;
  padding: 14px;
}

.lyrics-panel-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.lyrics-timestamp-list {
  min-height: 0;
  overflow: auto;
  border: 1px solid #26323d;
  border-radius: 6px;
}

.lyrics-timestamp-row {
  display: grid;
  grid-template-columns: 44px 132px 132px minmax(0, 1fr);
  gap: 10px;
  align-items: center;
  padding: 8px 10px;
  border-bottom: 1px solid #26323d;
}

.lyrics-timestamp-row.is-head {
  position: sticky;
  top: 0;
  background: #18222c;
  color: #9fb0c0;
  font-size: 12px;
}

.lyrics-timestamp-row strong {
  min-width: 0;
  font-size: 13px;
  font-weight: 500;
  overflow-wrap: anywhere;
}

pre {
  min-height: 0;
  height: 100%;
  margin: 0;
  overflow: auto;
  padding: 12px;
  border: 1px solid #26323d;
  border-radius: 6px;
  background: #0c1117;
  color: #c8d4df;
}

@media (max-width: 760px) {
  .lyrics-panel-grid {
    grid-template-columns: 1fr;
  }

  .lyrics-panel-controls {
    border-right: 0;
    border-bottom: 1px solid #26323d;
  }

  .lyrics-timestamp-row {
    grid-template-columns: 34px 102px 102px minmax(0, 1fr);
  }
}

  `]
})
export class LyricsTimestampPanelComponent {
  @Input() context: LyricsTimestampPanelContext = {
    projectPath: '',
    lyricsFile: '',
    audioFile: '',
    timingHintsFile: '',
    outputPath: ''
  };
  @Input() compact = false;
  @Output() runRequested = new EventEmitter<LyricsTimestampPanelContext>();
  @Output() saveRequested = new EventEmitter<LyricsTimestampPanelContext>();

  protected status = 'Ready';
  protected activeTab: 'mapped' | 'raw' = 'mapped';

  protected readonly sampleLines = [
    { index: 1, start: '00:00.000', end: '00:04.100', text: 'Bright star, would I were stedfast as thou art' },
    { index: 2, start: '00:04.100', end: '00:08.200', text: 'Not in lone splendour hung aloft the night' },
    { index: 3, start: '00:08.200', end: '00:12.900', text: 'And watching, with eternal lids apart' }
  ];

  protected updateField(key: keyof LyricsTimestampPanelContext, value: string): void {
    this.context = { ...this.context, [key]: value };
  }

  protected run(): void {
    this.status = 'Run requested by workflow';
    this.runRequested.emit(this.context);
  }

  protected save(): void {
    this.status = 'Save requested by workflow';
    this.saveRequested.emit(this.context);
  }
}
