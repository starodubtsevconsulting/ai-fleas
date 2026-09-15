import {
  Component,
  OnDestroy,
  OnInit,
  signal,
  ViewEncapsulation,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { Target, Context, LogToken } from "./models";
import { ControllerHeaderComponent } from "./components/controller-header/controller-header.component";
import { ProfileSelectorComponent } from "./components/profile-selector/profile-selector.component";
import { ServerListComponent } from "./components/server-list/server-list.component";
import { ServerDetailsComponent } from "./components/server-details/server-details.component";
import { ConnectorLogsComponent } from "./components/connector-logs/connector-logs.component";
@Component({
  selector: "app-root",
  standalone: true,
  imports: [
    CommonModule,
    ControllerHeaderComponent,
    ProfileSelectorComponent,
    ServerListComponent,
    ServerDetailsComponent,
    ConnectorLogsComponent,
  ],
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.css",
  encapsulation: ViewEncapsulation.Emulated,
})
export class AppComponent implements OnInit, OnDestroy {
  contexts = signal<Context[]>([]);
  selectedContext = signal("");
  targets = signal<Target[]>([]);
  selectedId = signal("");
  detailsClosed = signal(false);
  detailsWidth = signal(300);
  logHeight = signal(260);
  coloredLogs = signal<LogToken[][]>([]);
  error = signal("");
  refreshing = signal(false);
  timer?: number;
  private defaultSelectionApplied = false;
  key(c: Context) {
    return `${c.profileId}|${c.workflow}`;
  }
  selected() {
    return this.targets().find((x) => x.providerId === this.selectedId());
  }
  message(e: unknown) {
    return e instanceof Error ? e.message : String(e);
  }
  color(line: string) {
    const pattern =
      /(\[[^\]]+\])|(\b(?:ERR|ERROR|FATAL|FAIL(?:ED)?)\b)|(\bWARN(?:ING)?\b)|(\bINF(?:O)?\b)|(\b(?:PASS|healthy|successful|success|online|open)\b)|(https?:\/\/\S+|\b(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?\b)|(\b\d{4}-\d\d-\d\dT\S+?Z\b)/gi;
    const result: LogToken[] = [];
    let at = 0;
    for (const match of line.matchAll(pattern)) {
      if (match.index! > at)
        result.push({ text: line.slice(at, match.index), kind: "" });
      const text = match[0];
      const lower = text.toLowerCase();
      const kind = text.startsWith("[")
        ? "server"
        : /err|fatal|fail/.test(lower)
          ? "error"
          : /warn/.test(lower)
            ? "warning"
            : /^inf/.test(lower)
              ? "info"
              : /pass|health|success|online|open/.test(lower)
                ? "success"
                : /^https?:|^\d+\./.test(lower)
                  ? "address"
                  : "timestamp";
      result.push({ text, kind });
      at = match.index! + text.length;
    }
    if (at < line.length) result.push({ text: line.slice(at), kind: "" });
    return result;
  }
  addLog(line: string) {
    this.coloredLogs.update((v) => [...v.slice(-4999), this.color(line)]);
  }
  async ngOnInit() {
    try {
      const c = await window.cloudflareTunnel.contexts();
      this.contexts.set(c.contexts);
      if (c.selected) this.selectedContext.set(this.key(c.selected));
      window.cloudflareTunnel.onLog((x) => this.addLog(x));
      this.coloredLogs.set(
        (await window.cloudflareTunnel.logs())
          .slice(-5000)
          .map((x) => this.color(x)),
      );
      await this.refresh();
    } catch (e) {
      this.error.set(this.message(e));
    }
    this.timer = window.setInterval(() => this.refresh(), 30000);
  }
  ngOnDestroy() {
    clearInterval(this.timer);
  }
  async refresh() {
    if (this.refreshing()) return;
    this.refreshing.set(true);
    try {
      const previous = new Map(this.targets().map((x) => [x.providerId, x]));
      const rows = await window.cloudflareTunnel.targets();
      if (!this.defaultSelectionApplied && rows.length) {
        this.selectedId.set(rows[0].providerId);
        this.defaultSelectionApplied = true;
      }
      const now = Date.now();
      this.targets.set(
        rows.map((x) => ({
          ...x,
          seenAt: x.connectorDetected
            ? previous.get(x.providerId)?.seenAt || now
            : undefined,
        })),
      );
      this.error.set("");
    } catch (e) {
      this.error.set(`Unable to refresh server status: ${this.message(e)}`);
    } finally {
      this.refreshing.set(false);
    }
  }
  select(s: Target) {
    this.selectedId.set(s.providerId);
    this.detailsClosed.set(false);
  }
  async selectContext(v: string) {
    const [profileId, workflow] = v.split("|");
    this.selectedContext.set(v);
    try {
      const r = await window.cloudflareTunnel.selectContext({
        profileId,
        workflow,
      });
      this.targets.set(r.targets);
      this.selectedId.set(r.targets[0]?.providerId || "");
      this.defaultSelectionApplied = r.targets.length > 0;
      this.error.set("");
    } catch (e) {
      this.error.set(this.message(e));
    }
  }
  async start(s: Target, e: Event) {
    e.stopPropagation();
    await window.cloudflareTunnel.start(s.providerId);
    await this.refresh();
  }
  async stop(s: Target, e: Event) {
    e.stopPropagation();
    await window.cloudflareTunnel.stop(s.providerId);
    await this.refresh();
  }
  open(s: Target) {
    if (s.publicUrl) window.cloudflareTunnel.openPublicUrl(s.providerId);
  }
  uptime(s: Target) {
    if (!s.seenAt) return "—";
    const n = Math.floor((Date.now() - s.seenAt) / 1000);
    return n < 60 ? `${n}s` : `${Math.floor(n / 60)}m ${n % 60}s`;
  }
  resizeRight(e: PointerEvent) {
    e.preventDefault();
    const move = (x: PointerEvent) =>
      this.detailsWidth.set(
        Math.max(220, Math.min(520, innerWidth - x.clientX)),
      );
    const up = () => {
      removeEventListener("pointermove", move);
      removeEventListener("pointerup", up);
    };
    addEventListener("pointermove", move);
    addEventListener("pointerup", up);
  }
  resizeLogs(e: PointerEvent) {
    e.preventDefault();
    const move = (x: PointerEvent) =>
      this.logHeight.set(
        Math.max(42, Math.min(innerHeight - 220, innerHeight - x.clientY - 14)),
      );
    const up = () => {
      removeEventListener("pointermove", move);
      removeEventListener("pointerup", up);
    };
    addEventListener("pointermove", move);
    addEventListener("pointerup", up);
  }
}
