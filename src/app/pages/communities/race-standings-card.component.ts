import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { TournamentRaceStanding } from '../model/community-tournament';

/** Displays API-backed standing positions; no sorting or points calculation. */
@Component({
  selector: 'app-race-standings-card',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './race-standings-card.component.html',
  styleUrls: ['./race-standings-card.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RaceStandingsCardComponent {
  @Input({ required: true }) standings!: readonly TournamentRaceStanding[];
}
