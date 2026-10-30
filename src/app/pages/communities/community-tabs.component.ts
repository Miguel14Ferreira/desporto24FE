import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { TranslatePipe } from '../../i18n/translate.pipe';

export type CommunityTabChoice =
  'home' | 'feed' | 'chat' | 'sessions' | 'tournaments' | 'ranking' | 'stats' | 'members';

/** Presentation-only community navigation. The parent retains all tab logic, data access and permissions. */
@Component({
  selector: 'app-community-tabs',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './community-tabs.component.html',
  styleUrls: ['./community-tabs.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CommunityTabsComponent {
  @Input() activeTab: CommunityTabChoice = 'home';
  @Input() hasCompetitions = false;
  @Input() canBrowseHistoricalArchives = false;
  @Input() rankingsEnabled = false;
  @Output() tabRequested = new EventEmitter<CommunityTabChoice>();
}
