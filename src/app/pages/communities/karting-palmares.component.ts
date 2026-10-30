import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { appTranslate as t } from '../../i18n/i18n.service';
import { CommunityTournament } from '../model/community-tournament';

/** Displays the archived race competition list; selection remains managed by its parent. */
@Component({
  selector: 'app-karting-palmares',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  templateUrl: './karting-palmares.component.html',
  styleUrls: ['./karting-palmares.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class KartingPalmaresComponent {
  @Input({ required: true }) tournaments: readonly CommunityTournament[] = [];
  @Input() selectedId: number | null = null;
  @Input() hasMore = false;
  @Output() tournamentSelected = new EventEmitter<CommunityTournament>();

  raceSportLabel(sport: string | null | undefined): string {
    return sport === 'BMX' ? 'BMX Racing'
      : (sport || t('communities.tournaments.classificationUi.raceFallback'));
  }
}
