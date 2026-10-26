import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { CommunitySwitchComponent } from './community-switch.component';

/** Display and draft editing only: permission, persistence and official point rules stay in the page. */
@Component({
  selector: 'app-community-competition-settings',
  standalone: true,
  imports: [FormsModule, TranslatePipe, CommunitySwitchComponent],
  templateUrl: './community-competition-settings.component.html',
  styleUrls: ['./community-competition-settings.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CommunityCompetitionSettingsComponent {
  @Input() enabled = false;
  @Input() winPoints = 3;
  @Input() drawPoints = 1;
  @Input() lossPoints = 0;
  @Input() saving = false;
  @Output() enabledChange = new EventEmitter<boolean>();
  @Output() winPointsChange = new EventEmitter<number>();
  @Output() drawPointsChange = new EventEmitter<number>();
  @Output() lossPointsChange = new EventEmitter<number>();
  @Output() saveRequested = new EventEmitter<void>();
}
