import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { CommunityStanding } from '../model/community-group';
import { communityComparisonKey } from './community-player-comparison';

/** Read-only records, chart and player comparison for the existing community standings.
 * The parent retains ranking filters, tie rules, selected usernames and all persistence.
 */
@Component({
  selector: 'app-community-performance-insights',
  standalone: true,
  imports: [FormsModule, TranslatePipe],
  templateUrl: './community-performance-insights.component.html',
  styleUrls: ['./community-performance-insights.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CommunityPerformanceInsightsComponent {
  @Input() rows: readonly CommunityStanding[] = [];
  @Input() mostGames?: CommunityStanding;
  @Input() bestWinRate?: CommunityStanding;
  @Input() bestWinStreak?: CommunityStanding;
  @Input() maxStandingPoints = 0;
  @Input() compareSelectionA = '';
  @Input() compareSelectionB = '';
  @Input() comparePlayerA?: CommunityStanding;
  @Input() comparePlayerB?: CommunityStanding;
  @Output() compareAChange = new EventEmitter<string>();
  @Output() compareBChange = new EventEmitter<string>();

  /** Every visible ranking entry gets a distinct key, even without an account or username. */
  selectionKey(index: number): string {
    return communityComparisonKey(index);
  }

  /** Same percentage calculation as CommunitiesComponent.pointsBarWidth. */
  pointsBarWidth(row: CommunityStanding): number {
    if (this.maxStandingPoints <= 0) return 0;
    return Math.max(4, Math.round((row.points / this.maxStandingPoints) * 100));
  }
}
