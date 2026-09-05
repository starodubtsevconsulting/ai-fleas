import 'zone.js';
import { CommonModule } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { bootstrapApplication } from '@angular/platform-browser';

type VideoMode = 'per-line' | 'single';
type TextPosition = 'top' | 'center' | 'bottom';
type TextAlign = 'left' | 'center';
type RevealStyle = 'stroke' | 'crop';
type OutputTab = 'lyrics' | 'log';
type ResolutionPreset = '1920x1080' | '1080x1920' | '1080x1080' | '3840x2160' | 'custom';

type LaunchContext = {
  breadcrumbLabel?: string;
  videoPath?: string;
  projectPath?: string;
  scopeType?: string;
  scopePath?: string;
  textFilePath?: string;
  suggestedTextFilePath?: string;
  outputPath?: string;
};

const RESOLUTION_PRESETS: { value: ResolutionPreset; label: string; width: number; height: number }[] = [
  { value: '1920x1080', label: 'HD 16:9', width: 1920, height: 1080 },
  { value: '1080x1920', label: 'HD 9:16', width: 1080, height: 1920 },
  { value: '1080x1080', label: 'Square HD', width: 1080, height: 1080 },
  { value: '3840x2160', label: '4K 16:9', width: 3840, height: 2160 },
  { value: 'custom', label: 'Custom', width: 1920, height: 1080 }
];

type RenderForm = {
  fontName: string;
  textFile: string;
  dist: string;
  maxLines: string;
  videoMode: VideoMode;
  resolutionPreset: ResolutionPreset;
  width: number;
  height: number;
  transparent: boolean;
  inkColor: string;
  letterHeight: number;
  textPosition: TextPosition;
  textAlign: TextAlign;
  bottomMargin: number;
  tailSymbols: number;
  revealStyle: RevealStyle;
  jobs: string;
};

type LauncherInitialState = { commandDir: string; fonts: string[]; launchContext?: LaunchContext; breadcrumbLabel?: string; defaultTextFile?: string; defaultOutputPath?: string };

type TextPreview = { path: string; content: string; truncated: boolean; available: boolean; message: string };
type PreviewLine = { number: number | null; text: string };

type LauncherApi = {
  initialState(): Promise<LauncherInitialState>;
  chooseTextFile(): Promise<string>;
  chooseOutputPath(options: { videoMode: VideoMode; transparent: boolean }): Promise<string>;
  readTextPreview(targetPath: string): Promise<TextPreview>;
  run(options: RenderForm): Promise<{ started: boolean }>;
  stop(): Promise<void>;
  openPath(path: string): Promise<void>;
  onLog(callback: (entry: { stream: 'stdout' | 'stderr' | 'system'; text: string }) => void): () => void;
  onRunning(callback: (running: boolean) => void): () => void;
  onLaunchContext?(callback: (state: LauncherInitialState) => void): () => void;
};

declare global {
  interface Window { handwritingLauncher?: LauncherApi; }
}

@Component({
  selector: 'vhe-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app/app.component.html',
  styleUrl: './app/app.component.css'
})
class AppComponent {
  readonly api = window.handwritingLauncher;
  readonly commandDir = signal('');
  readonly launchBreadcrumb = signal('');
  readonly fonts = signal<string[]>([]);
  readonly running = signal(false);
  readonly logs = signal<string[]>([]);
  readonly renderStarted = signal(false);
  readonly activeOutputTab = signal<OutputTab>('lyrics');
  readonly resolutionPresets = RESOLUTION_PRESETS;
  readonly textPreview = signal<TextPreview>({ path: '', content: '', truncated: false, available: false, message: 'No text file selected.' });
  readonly selectedLineNumbers = signal<Set<number>>(new Set());
  private textPreviewRequestId = 0;
  readonly selectedLineCount = computed(() => this.selectedPreviewLines().length);
  readonly form = signal<RenderForm>({
    fontName: 'font-1',
    textFile: '',
    dist: '',
    maxLines: 'all',
    videoMode: 'single',
    resolutionPreset: '1920x1080',
    width: 1920,
    height: 1080,
    transparent: true,
    inkColor: '255,255,255',
    letterHeight: 48,
    textPosition: 'bottom',
    textAlign: 'center',
    bottomMargin: 120,
    tailSymbols: 20,
    revealStyle: 'stroke',
    jobs: 'auto'
  });
  readonly commandPreview = computed(() => this.buildCommandPreview(this.form()));
  readonly previewLines = computed<PreviewLine[]>(() => {
    const preview = this.textPreview();
    const lines: PreviewLine[] = this.renderableLinesForPreview(preview).map((line, index) => ({ number: index + 1, text: line }));
    if (preview.available && preview.truncated) {
      lines.push({ number: null, text: '... truncated' });
    }
    return lines;
  });
  readonly selectedPreviewLines = computed(() => {
    const selected = this.selectedLineNumbers();
    return this.previewLines()
      .filter((line): line is { number: number; text: string } => line.number !== null && selected.has(line.number))
      .map((line) => line.text);
  });
  readonly allPreviewLinesSelected = computed(() => {
    const selectableLines = this.previewLines().filter((line) => line.number !== null);
    return selectableLines.length > 0 && this.selectedLineCount() === selectableLines.length;
  });
  readonly validationIssues = computed(() => {
    const form = this.form();
    const issues: string[] = [];
    if (!form.fontName.trim()) {
      issues.push('Font is required.');
    }
    if (!form.textFile.trim()) {
      issues.push('Text file is required.');
    }
    if (!form.dist.trim()) {
      issues.push('Output folder is required.');
    }
    if (this.textPreview().available && this.selectedLineCount() === 0) {
      issues.push('Select at least one lyric line.');
    }
    if (!Number.isInteger(form.width) || form.width <= 0) {
      issues.push('Width must be a positive whole number.');
    }
    if (!Number.isInteger(form.height) || form.height <= 0) {
      issues.push('Height must be a positive whole number.');
    }
    return issues;
  });
  readonly canRun = computed(() => !this.running() && this.validationIssues().length === 0);

  constructor() {
    this.api?.initialState().then((state) => this.applyInitialState(state, true));
    this.api?.onLaunchContext?.((state) => this.applyInitialState(state, false));
    this.api?.onLog((entry) => {
      const prefix = entry.stream === 'stderr' ? 'err' : entry.stream === 'system' ? 'sys' : 'out';
      this.logs.update((lines) => [...lines, `[${prefix}] ${entry.text}`].slice(-700));
    });
    this.api?.onRunning((value) => this.running.set(value));
  }

  patch(value: Partial<RenderForm>): void {
    const previousTextFile = this.form().textFile;
    this.form.update((current) => ({ ...current, ...value }));
    if (Object.prototype.hasOwnProperty.call(value, 'textFile') && value.textFile !== previousTextFile) {
      this.renderStarted.set(false);
      this.logs.set([]);
      void this.loadTextPreview(value.textFile || '');
    }
  }

  setResolutionPreset(value: ResolutionPreset): void {
    const preset = this.resolutionPresets.find((candidate) => candidate.value === value);
    if (!preset || preset.value === 'custom') {
      this.patch({ resolutionPreset: 'custom' });
      return;
    }
    this.patch({ resolutionPreset: preset.value, width: preset.width, height: preset.height });
  }

  patchResolution(value: Partial<Pick<RenderForm, 'width' | 'height'>>): void {
    const next = { ...this.form(), ...value };
    const matchedPreset = this.resolutionPresets.find((preset) => preset.value !== 'custom' && preset.width === next.width && preset.height === next.height);
    this.patch({ ...value, resolutionPreset: matchedPreset?.value || 'custom' });
  }

  private async loadTextPreview(targetPath: string): Promise<void> {
    const requestId = ++this.textPreviewRequestId;
    if (!targetPath.trim()) {
      this.setTextPreview({ path: '', content: '', truncated: false, available: false, message: 'No text file selected.' });
      return;
    }
    this.setTextPreview({ path: targetPath, content: '', truncated: false, available: false, message: 'Loading text preview.' });
    try {
      const preview = await this.api?.readTextPreview(targetPath);
      if (requestId === this.textPreviewRequestId) {
        this.setTextPreview(preview || { path: targetPath, content: '', truncated: false, available: false, message: 'Text preview unavailable.' });
      }
    } catch (error) {
      if (requestId === this.textPreviewRequestId) {
        this.setTextPreview({ path: targetPath, content: '', truncated: false, available: false, message: error instanceof Error ? error.message : 'Text preview unavailable.' });
      }
    }
  }

  private setTextPreview(preview: TextPreview): void {
    this.textPreview.set(preview);
    const lineCount = this.renderableLinesForPreview(preview).length;
    this.selectedLineNumbers.set(new Set(Array.from({ length: lineCount }, (_value, index) => index + 1)));
    this.syncLinesSpecToSelection();
  }

  private renderableLinesForPreview(preview: TextPreview): string[] {
    if (!preview.available) {
      return [];
    }
    return preview.content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }

  private lineSpecForSelection(): string {
    const allNumbers = this.previewLines()
      .map((line) => line.number)
      .filter((number): number is number => number !== null);
    const selected = Array.from(this.selectedLineNumbers()).sort((a, b) => a - b);
    if (selected.length === 0) {
      return '';
    }
    if (allNumbers.length > 0 && selected.length === allNumbers.length && selected.every((number, index) => number === allNumbers[index])) {
      return 'all';
    }
    const parts: string[] = [];
    for (let index = 0; index < selected.length; index += 1) {
      const start = selected[index];
      let end = start;
      while (index + 1 < selected.length && selected[index + 1] === end + 1) {
        index += 1;
        end = selected[index];
      }
      parts.push(start === end ? String(start) : `${start}-${end}`);
    }
    return parts.join(',');
  }

  private syncLinesSpecToSelection(): void {
    this.patch({ maxLines: this.lineSpecForSelection() });
  }

  private applyInitialState(state: LauncherInitialState, updateFonts: boolean): void {
    this.commandDir.set(state.commandDir);
    this.launchBreadcrumb.set(state.breadcrumbLabel || state.launchContext?.breadcrumbLabel || '');
    if (updateFonts) {
      this.fonts.set(state.fonts);
      if (state.fonts.includes('font-1')) {
        this.patch({ fontName: 'font-1' });
      } else if (state.fonts[0]) {
        this.patch({ fontName: state.fonts[0] });
      }
    }
    this.patch({
      textFile: state.defaultTextFile || state.launchContext?.textFilePath || '',
      dist: state.defaultOutputPath || state.launchContext?.outputPath || ''
    });
  }

  applyTransparentDefaults(): void {
    if (!this.form().transparent) {
      return;
    }
    const dist = this.form().dist.trim();
    this.patch({
      inkColor: this.form().inkColor || '255,255,255',
      dist: dist.endsWith('.mp4') ? dist.replace(/\.mp4$/i, '.mov') : dist
    });
  }

  async chooseTextFile(): Promise<void> {
    const value = await this.api?.chooseTextFile();
    if (value) {
      this.patch({ textFile: value });
    }
  }

  async chooseOutputPath(): Promise<void> {
    const value = await this.api?.chooseOutputPath({ videoMode: this.form().videoMode, transparent: this.form().transparent });
    if (value) {
      this.patch({ dist: value });
    }
  }

  inkHex(): string {
    const parts = this.form().inkColor.split(',').map((part) => Number(part.trim()));
    if (parts.length < 3 || parts.some((part) => !Number.isFinite(part) || part < 0 || part > 255)) {
      return '#ffffff';
    }
    return `#${parts.slice(0, 3).map((part) => Math.round(part).toString(16).padStart(2, '0')).join('')}`;
  }

  setInkHex(value: string): void {
    const match = value.match(/^#?([0-9a-f]{6})$/i);
    if (!match) {
      return;
    }
    const hex = match[1];
    const channels = [hex.slice(0, 2), hex.slice(2, 4), hex.slice(4, 6)].map((part) => String(parseInt(part, 16)));
    this.patch({ inkColor: channels.join(',') });
  }

  toggleLine(number: number | null, checked: boolean): void {
    if (number === null) {
      return;
    }
    const next = new Set(this.selectedLineNumbers());
    if (checked) {
      next.add(number);
    } else {
      next.delete(number);
    }
    this.selectedLineNumbers.set(next);
    this.syncLinesSpecToSelection();
  }

  toggleAllLines(checked: boolean): void {
    if (!checked) {
      this.selectedLineNumbers.set(new Set());
      this.syncLinesSpecToSelection();
      return;
    }
    const allNumbers = this.previewLines()
      .map((line) => line.number)
      .filter((number): number is number => number !== null);
    this.selectedLineNumbers.set(new Set(allNumbers));
    this.syncLinesSpecToSelection();
  }

  isLineSelected(number: number | null): boolean {
    return number !== null && this.selectedLineNumbers().has(number);
  }

  setOutputTab(tab: OutputTab): void {
    this.activeOutputTab.set(tab);
  }

  async run(): Promise<void> {
    if (!this.api || !this.canRun()) {
      return;
    }
    this.renderStarted.set(true);
    this.activeOutputTab.set('log');
    this.logs.set([]);
    await this.api.run(this.form());
  }

  async stop(): Promise<void> {
    await this.api?.stop();
  }

  async openOutput(): Promise<void> {
    await this.api?.openPath(this.form().dist);
  }

  private outputDistForMode(form: RenderForm): string {
    const base = form.dist.trim();
    if (form.videoMode !== 'per-line' || !base) {
      return base;
    }
    const normalized = base.replace(/[\\/]+$/, '');
    if (/(^|[\\/])per-line$/i.test(normalized)) {
      return normalized;
    }
    return `${normalized}/per-line`;
  }

  private buildCommandPreview(form: RenderForm): string {
    const args = [
      './video-handwriting-effect.command.sh',
      '--font-name', form.fontName,
      '--text-file', form.textFile,
      '--dist', this.outputDistForMode(form),
      '--video-mode', form.videoMode,
      '--width', String(form.width),
      '--height', String(form.height)
    ];
    if (form.transparent) {
      args.push('--transparent');
    }
    args.push(
      '--lines', form.maxLines || 'all',
      '--ink-color', form.inkColor,
      '--letter-height', String(form.letterHeight),
      '--text-position', form.textPosition,
      '--text-align', form.textAlign,
      '--bottom-margin', String(form.bottomMargin),
      '--tail-symbols', String(form.tailSymbols),
      '--reveal-style', form.revealStyle,
      '--jobs', form.jobs
    );
    return args.map((value, index) => index === 0 ? value : `  ${this.shellQuote(value)}`).join(' \\\n');
  }

  private shellQuote(value: string): string {
    if (/^[A-Za-z0-9_./:=,+-]+$/.test(value)) {
      return value;
    }
    return `'${value.replace(/'/g, `'\\''`)}'`;
  }
}

bootstrapApplication(AppComponent).catch((error) => console.error(error));
