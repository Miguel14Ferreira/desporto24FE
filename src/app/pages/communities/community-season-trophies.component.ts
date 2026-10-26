import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { CommunitySeason } from '../model/community-group';

/** Read-only champions history, never determines the official season winner. */
@Component({
  selector: 'app-community-season-trophies',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './community-season-trophies.component.html',
  styleUrls: ['./community-season-trophies.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CommunitySeasonTrophiesComponent {
  @Input() seasons: readonly CommunitySeason[] = [];
}
