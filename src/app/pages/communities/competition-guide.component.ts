import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { TranslatePipe } from '../../i18n/translate.pipe';
/** Guide only; parent retains organizer authorization and creation actions. */
@Component({
  selector: 'app-competition-guide',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './competition-guide.component.html',
  styleUrls: ['./competition-guide.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CompetitionGuideComponent {
  @Input() canManage = false;
  @Input() individualEnabled = true;
  @Input() teamEnabled = true;
  @Output() individualSelected = new EventEmitter<void>();
  @Output() teamSelected = new EventEmitter<void>();
  @Output() closeRequested = new EventEmitter<void>();
}
