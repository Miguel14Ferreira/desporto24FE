import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { TranslatePipe } from '../../i18n/translate.pipe';

/** Only presents already-resolved values supplied by CommunitiesComponent. */
@Component({
  selector: 'app-community-overview-stats',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './community-overview-stats.component.html',
  styleUrls: ['./community-overview-stats.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CommunityOverviewStatsComponent {
  @Input() memberCount = 0;
  @Input() sports: readonly string[] = [];
  @Input() visibility = 'PUBLIC';
  @Input() rankingsEnabled = false;
}
