import {
  Component,
  Input,
  Output,
  EventEmitter,
  ViewEncapsulation,
} from "@angular/core";
import { CommonModule } from "@angular/common";
import { Context } from "../../models";
@Component({
  selector: "app-profile-selector",
  standalone: true,
  imports: [CommonModule],
  templateUrl: "./profile-selector.component.html",
  styleUrl: "./profile-selector.component.css",
  encapsulation: ViewEncapsulation.Emulated,
})
export class ProfileSelectorComponent {
  @Input()
  contexts: Context[] = [];
  @Input()
  selectedContext = "";
  @Output()
  contextSelected = new EventEmitter<string>();
  key(c: Context) {
    return `${c.profileId}|${c.workflow}`;
  }
}
