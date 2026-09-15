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
  selector: "app-server-details",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./server-details.component.html",
  styleUrl: "./server-details.component.css",
  encapsulation: ViewEncapsulation.Emulated,
})
export class ServerDetailsComponent {
  @Input()
  target?: Target;
  @Input()
  width = 300;
  @Output()
  collapsed = new EventEmitter<void>();
  @Output()
  urlRequested = new EventEmitter<Target>();
  uptime(s: Target) {
    if (!s.seenAt) return "—";
    const n = Math.floor((Date.now() - s.seenAt) / 1000);
    return n < 60 ? `${n}s` : `${Math.floor(n / 60)}m ${n % 60}s`;
  }
}
