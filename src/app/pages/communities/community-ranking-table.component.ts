import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { ProfileQuickViewService } from '../../services/profile-quick-view.service';
import { CommunityStanding } from '../model/community-group';

/** Ranking is read-only; selecting a name opens an existing profile or asks the parent to confirm a self-claim. */
@Component({
  selector: 'app-community-ranking-table',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './community-ranking-table.component.html',
  styleUrls: ['./community-ranking-table.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CommunityRankingTableComponent {
  @Input() rows: readonly CommunityStanding[] = [];
  @Output() historicalSelected = new EventEmitter<CommunityStanding>();

  constructor(private readonly quickView: ProfileQuickViewService) {}

  openPlayer(row: CommunityStanding): void {
    if (row.username?.trim()) {
      this.quickView.open(row.username);
    } else {
      this.historicalSelected.emit(row);
    }
  }
}
