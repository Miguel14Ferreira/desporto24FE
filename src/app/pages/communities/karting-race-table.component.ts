import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { TournamentRaceEntry, TournamentRaceRound } from '../model/community-tournament';
import {
  formatKartingDuration,
  kartingRaceAward,
  orderedKartingRaceEntries
} from './community-karting-race-display';

/** Read-only race standings; the API and parent retain all scoring and save operations. */
@Component({
  selector: 'app-karting-race-table',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './karting-race-table.component.html',
  styleUrls: ['./karting-race-table.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class KartingRaceTableComponent {
  @Input({ required: true }) race!: TournamentRaceRound;
  @Input() sport: string | null | undefined;
  @Input() pointsByPlace: readonly number[] = [];

  hasRaceLaps(entries: readonly TournamentRaceEntry[]): boolean {
    return entries.some(entry => entry.lapsCompleted != null);
  }
  hasRaceBestLap(entries: readonly TournamentRaceEntry[]): boolean {
    return entries.some(entry => entry.bestLapSeconds != null);
  }
  orderedKartingRaceEntries(entries: readonly TournamentRaceEntry[]): TournamentRaceEntry[] {
    return orderedKartingRaceEntries(entries);
  }
  formatKartingDuration(seconds: number | null | undefined): string {
    return formatKartingDuration(seconds);
  }
  kartingRaceAward(entry: TournamentRaceEntry): number {
    return kartingRaceAward(entry, this.pointsByPlace);
  }
}
