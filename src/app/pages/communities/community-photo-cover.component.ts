import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { TranslatePipe } from '../../i18n/translate.pipe';

/** Display-only cover; upload, crop and persistence stay in CommunitiesComponent. */
@Component({
  selector: 'div[app-community-photo-cover]',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './community-photo-cover.component.html',
  styleUrls: ['./community-photo-cover.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CommunityPhotoCoverComponent {
  @Input() photoUrl: string | null | undefined = null;
  @Input() name = '';
  @Input() initials = '';
  @Input() animated = false;
  @Input() showAll = false;
  @Input() fit = 'cover';
  @Input() position = '50% 50%';
  @Input() origin = '50% 50%';
  @Input() zoom: string | null = null;
  @Input() canManage = false;
  @Input() updating = false;
  @Output() photoSelected = new EventEmitter<Event>();
  @Output() adjustRequested = new EventEmitter<void>();
  @Output() removeRequested = new EventEmitter<void>();
}
