import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { TranslatePipe } from '../../i18n/translate.pipe';

/** Active season UI only: closure permissions, confirmation and persistence stay in CommunitiesComponent. */
@Component({
  selector: 'app-community-active-season-card',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './community-active-season-card.component.html',
  styleUrls: ['./community-active-season-card.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CommunityActiveSeasonCardComponent {
  @Input() name = '';
  @Input() confirming = false;
  @Input() saving = false;
  @Output() requestClose = new EventEmitter<void>();
  @Output() confirmClose = new EventEmitter<void>();
  @Output() cancelClose = new EventEmitter<void>();
}
