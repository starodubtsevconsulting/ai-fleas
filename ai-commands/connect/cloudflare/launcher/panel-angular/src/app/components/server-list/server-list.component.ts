import {
  Component,
  Input,
  Output,
  EventEmitter,
  ViewEncapsulation,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { Target } from "../../models";
@Component({
  selector: "app-server-list",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./server-list.component.html",
  styleUrl: "./server-list.component.css",
  encapsulation: ViewEncapsulation.Emulated,
})
export class ServerListComponent {
  @Input()
  targets: Target[] = [];
  @Input()
  selectedId = "";
  @Output()
  serverSelected = new EventEmitter<Target>();
  @Output()
  startRequested = new EventEmitter<{
    target: Target;
    event: Event;
  }>();
  @Output()
  stopRequested = new EventEmitter<{
    target: Target;
    event: Event;
  }>();
  start(target: Target, event: Event) {
    event.stopPropagation();
    this.startRequested.emit({ target, event });
  }
  stop(target: Target, event: Event) {
    event.stopPropagation();
    this.stopRequested.emit({ target, event });
  }
}
