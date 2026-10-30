import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { CommunityInvite } from '../model/community-group';

/** Pending invitations only. Authentication, deep-link validation and actions stay in CommunitiesComponent. */
@Component({
  selector: 'app-community-pending-invites',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './community-pending-invites.component.html',
  styleUrls: ['./community-pending-invites.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CommunityPendingInvitesComponent {
  @Input() invites: readonly CommunityInvite[] = [];
  @Input() targetedInviteId: number | null = null;
  @Output() acceptRequested = new EventEmitter<CommunityInvite>();
  @Output() rejectRequested = new EventEmitter<CommunityInvite>();
}
