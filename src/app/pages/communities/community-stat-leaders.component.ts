import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { CommunityStanding } from '../model/community-group';

/** Read-only leaderboard snapshot. Sorting and leader selection stay in CommunitiesComponent. */
@Component({
  selector: 'app-community-stat-leaders',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './community-stat-leaders.component.html',
  styleUrls: ['./community-stat-leaders.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CommunityStatLeadersComponent {
  @Input() leader?: CommunityStanding;
  @Input() goals?: CommunityStanding;
  @Input() assists?: CommunityStanding;
  @Input() mvps?: CommunityStanding;
  @Input() cleanSheets?: CommunityStanding;
}
