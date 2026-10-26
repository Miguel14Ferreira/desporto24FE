import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { CommunityStanding } from '../model/community-group';

/** Read-only ranking table. Season selection, member filtering and points rules remain with the parent. */
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
}
