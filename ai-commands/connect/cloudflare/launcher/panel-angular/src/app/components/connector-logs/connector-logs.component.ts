import {
  Component,
  Input,
  Output,
  EventEmitter,
  ViewEncapsulation,
  input,
  signal,
  computed,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { LogToken } from "../../models";
import { filterLogs } from "../../utils/log-filter";
@Component({
  selector: "app-connector-logs",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./connector-logs.component.html",
  styleUrl: "./connector-logs.component.css",
  encapsulation: ViewEncapsulation.Emulated,
})
export class ConnectorLogsComponent {
  @Input()
  height = 260;
  readonly lines = input<LogToken[][]>([]);
  readonly logQuery = signal("");
  readonly selectedServer = input("");
  @Output()
  allRequested = new EventEmitter<void>();
  @Output()
  collapseRequested = new EventEmitter<void>();
  readonly filteredLines = computed(() =>
    filterLogs(this.lines(), this.logQuery(), this.selectedServer()),
  );
}
