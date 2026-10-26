import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { CommunitySwitchComponent } from './community-switch.component';

/** Read-only ranking visibility control; the parent still filters rows. */
@Component({
  selector: 'app-community-ranking-visibility',
  standalone: true,
  imports: [TranslatePipe, CommunitySwitchComponent],
  templateUrl: './community-ranking-visibility.component.html',
  styleUrls: ['./community-ranking-visibility.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CommunityRankingVisibilityComponent {
  @Input() showAll = false;
  @Output() showAllChange = new EventEmitter<boolean>();
}
