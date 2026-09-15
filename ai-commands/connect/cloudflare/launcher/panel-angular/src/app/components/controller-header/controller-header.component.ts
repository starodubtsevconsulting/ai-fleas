import {
  Component,
  Input,
  Output,
  EventEmitter,
  ViewEncapsulation,
} from "@angular/core";
import { CommonModule } from "@angular/common";
@Component({
  selector: "app-controller-header",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./controller-header.component.html",
  styleUrl: "./controller-header.component.css",
  encapsulation: ViewEncapsulation.Emulated,
})
export class ControllerHeaderComponent {
  @Input()
  refreshing = false;
  @Output()
  refreshRequested = new EventEmitter<void>();
}
