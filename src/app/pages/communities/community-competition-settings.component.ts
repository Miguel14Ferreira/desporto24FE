import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { CommunitySwitchComponent } from './community-switch.component';
import { formatForSport } from './community-round-sport';

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
  @Input() sports: readonly string[] = [];
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

  /** Generic W/D/L applies only to head-to-head sports, never to a race by default. */
  get usesMatchPoints(): boolean {
    return this.sports.length === 0 || this.sports.some(sport => {
      const family = formatForSport(sport);
      return family === 'team' || family === 'duel';
    });
  }

  /** Read-only guidance; official race points are configured per sport and season. */
  specializedClassificationKey(sport: string): string | null {
    const family = formatForSport(sport);
    if (family === 'team' || family === 'duel') return null;
    return 'communities.tournaments.classificationUi.' + family + '.heading';
  }

  specializedDescriptionKey(sport: string): string {
    const family = formatForSport(sport);
    return family === 'race'
      ? 'communities.race.metricsEntryHint'
      : 'communities.tournaments.classificationUi.' + family + '.detail';
  }
}
