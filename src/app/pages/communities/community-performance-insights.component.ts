import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { CommunityStanding } from '../model/community-group';
import { CommunityComparePickerComponent } from './community-compare-picker.component';

/** Read-only records, chart and player comparison for the existing community standings.
 * The parent retains ranking filters, tie rules, selected usernames and all persistence.
 */
@Component({
  selector: 'app-community-performance-insights',
  standalone: true,
  imports: [TranslatePipe, CommunityComparePickerComponent],
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
  @Output() clearRequested = new EventEmitter<void>();

  /** Same percentage calculation as CommunitiesComponent.pointsBarWidth. */
  pointsBarWidth(row: CommunityStanding): number {
    if (this.maxStandingPoints <= 0) return 0;
    return Math.max(4, Math.round((row.points / this.maxStandingPoints) * 100));
  }
}
