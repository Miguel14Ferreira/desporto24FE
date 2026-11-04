import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { TournamentRaceRound, TournamentRaceStanding } from '../model/community-tournament';

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
  @Input() races: readonly TournamentRaceRound[] = [];
  expandedPlayerId: number | null = null;

  /** Linked race entries only; standings and points remain authoritative API values. */
  driverRaceResults(playerId: number): { raceId: number; name: string; position: string }[] {
    if (!Number.isSafeInteger(playerId) || playerId <= 0) return [];
    return this.races.flatMap(race => race.entries
      .filter(entry => entry.communityPlayerId === playerId)
      .map(entry => ({
        raceId: race.id,
        name: race.name,
        position: entry.raceDisqualified ? 'DSQ'
          : entry.finishPosition == null ? 'DNF'
          : this.displayPosition(entry.finishPosition)
      })));
  }

  toggleDriverRaces(playerId: number): void {
    this.expandedPlayerId = this.expandedPlayerId === playerId ? null : playerId;
  }


  podiumPosition(value: number | null | undefined): number | null {
    return Number.isSafeInteger(value) && value! >= 1 && value! <= 3 ? value! : null;
  }

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
