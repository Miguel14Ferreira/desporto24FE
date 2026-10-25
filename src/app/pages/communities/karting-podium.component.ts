import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { CommunityTournament, TournamentRaceStanding } from '../model/community-tournament';

/** Pure display of verified archived race results; parent keeps all scoring rules. */
@Component({
  selector: 'app-karting-podium',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './karting-podium.component.html',
  styleUrls: ['./karting-podium.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class KartingPodiumComponent {
  @Input({ required: true }) tournament!: CommunityTournament;
  @Input({ required: true }) podium!: readonly TournamentRaceStanding[];
}
