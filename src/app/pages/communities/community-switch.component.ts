import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

/** Accessible Concept One checkbox switch; all mutation decisions belong to its parent. */
@Component({
  selector: 'app-community-switch',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './community-switch.component.html',
  styleUrls: ['./community-switch.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CommunitySwitchComponent {
  @Input() checked = false;
  @Input() label = '';
  @Output() checkedChange = new EventEmitter<boolean>();
}
