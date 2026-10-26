import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { CommunityStanding } from '../model/community-group';

/** Read-only highlight; the parent decides if rankings and leader are available. */
@Component({
  selector: 'app-community-leader-highlight',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './community-leader-highlight.component.html',
  styleUrls: ['./community-leader-highlight.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CommunityLeaderHighlightComponent {
  @Input() standing?: CommunityStanding;
}
