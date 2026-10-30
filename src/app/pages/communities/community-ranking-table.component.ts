import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { ProfileQuickViewService } from '../../services/profile-quick-view.service';
import { environment } from 'src/environment/environment';
import { playerAvatarInitials, playerAvatarUrl } from '../../shared/player-avatar';
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

  avatarUrl(row: CommunityStanding): string | null {
    return row.username ? playerAvatarUrl(row.profilePicUrl, environment.apiUrl) : null;
  }

  initials(row: CommunityStanding): string {
    return playerAvatarInitials(row.fullName || row.username);
  }

  avatarFailed(event: Event): void {
    (event.target as HTMLImageElement).remove();
  }

  openPlayer(row: CommunityStanding): void {
    if (row.username?.trim()) {
      this.quickView.open(row.username);
    } else {
      this.historicalSelected.emit(row);
    }
  }
}
