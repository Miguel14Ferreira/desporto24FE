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

  displayPosition(value: number | null | undefined): string {
    return Number.isSafeInteger(value) && value! > 0 ? String(value) : '—';
  }

  displayCount(value: number | null | undefined): number | string {
    return Number.isSafeInteger(value) && value! >= 0 ? value! : '—';
  }

  displayPoints(value: number | null | undefined): number | string {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0
      ? value : '—';
  }
}
