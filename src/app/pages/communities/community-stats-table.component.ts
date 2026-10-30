import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { CommunityStanding } from '../model/community-group';

/** Read-only table. Existing season filters and standings retrieval remain in parent. */
@Component({
  selector: 'app-community-stats-table',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './community-stats-table.component.html',
  styleUrls: ['./community-stats-table.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CommunityStatsTableComponent {
  @Input() rows: readonly CommunityStanding[] = [];
}
