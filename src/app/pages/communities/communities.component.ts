import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { finalize } from 'rxjs';
import { appTranslate as t } from '../../i18n/i18n.service';

import {
  CommunityGroup,
  CommunityInvite,
  CommunityRole
} from '../model/community-group';
import { CommunityGroupsService } from '../../services/community-groups.service';

@Component({
  selector: 'app-communities',
  templateUrl: './communities.component.html',
  styleUrls: ['./communities.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false
})
export class CommunitiesComponent implements OnInit {
  communities: CommunityGroup[] = [];
  invites: CommunityInvite[] = [];
  selected?: CommunityGroup;

  loading = false;
  saving = false;
  errorMessage = '';

  inviteUsername = '';
  ownershipUsername = '';
  photoUpdating = false;

  constructor(
    private communityService: CommunityGroupsService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loading = true;
    this.errorMessage = '';

    this.communityService.mine()
      .pipe(finalize(() => this.loading = false))
      .subscribe({
        next: communities => {
          this.communities = communities;

          const requestedId = Number(this.route.snapshot.queryParamMap.get('community'));
          if (requestedId && !Number.isNaN(requestedId)) {
            const requested = communities.find(item => item.id === requestedId);
            if (requested) {
              this.open(requested);
              return;
            }
          }

          if (this.selected) {
            this.selected = communities.find(item => item.id === this.selected?.id);
          }
        },
        error: () => this.errorMessage = t('feedback.communities.loadError')
      });

    this.communityService.myInvites().subscribe({
      next: invites => this.invites = invites,
      error: () => this.invites = []
    });
  }

  open(community: CommunityGroup): void {
    this.communityService.get(community.id).subscribe({
      next: full => this.selected = full,
      error: () => this.errorMessage = t('feedback.communities.openError')
    });
  }

  invite(): void {
    if (!this.selected || !this.inviteUsername.trim() || this.saving) {
      return;
    }

    this.saving = true;
    this.errorMessage = '';

    this.communityService.invite(this.selected.id, this.inviteUsername.trim())
      .pipe(finalize(() => this.saving = false))
      .subscribe({
        next: () => this.inviteUsername = '',
        error: error => {
          this.errorMessage = error.error?.message || t('feedback.communities.inviteError');
        }
      });
  }

  acceptInvite(invite: CommunityInvite): void {
    this.communityService.acceptInvite(invite.id).subscribe({
      next: community => {
        this.invites = this.invites.filter(item => item.id !== invite.id);
        this.communities = [community, ...this.communities.filter(item => item.id !== community.id)];
        this.selected = community;
      },
      error: () => this.errorMessage = t('feedback.communities.acceptError')
    });
  }

  rejectInvite(invite: CommunityInvite): void {
    this.communityService.rejectInvite(invite.id).subscribe({
      next: () => this.invites = this.invites.filter(item => item.id !== invite.id),
      error: () => this.errorMessage = t('feedback.communities.rejectError')
    });
  }

  setRole(username: string, role: Exclude<CommunityRole, 'OWNER'>): void {
    if (!this.selected) {
      return;
    }

    this.communityService.updateRole(this.selected.id, username, role).subscribe({
      next: community => {
        this.selected = community;
        this.replaceCommunity(community);
      },
      error: () => this.errorMessage = t('feedback.communities.roleError')
    });
  }

  removeMember(username: string): void {
    if (!this.selected) {
      return;
    }

    this.communityService.removeMember(this.selected.id, username).subscribe({
      next: () => this.refreshSelected(),
      error: () => this.errorMessage = t('feedback.communities.removeError')
    });
  }

  leave(): void {
    if (!this.selected) {
      return;
    }

    const id = this.selected.id;
    this.communityService.leave(id).subscribe({
      next: () => {
        this.communities = this.communities.filter(item => item.id !== id);
        this.selected = undefined;
      },
      error: error => this.errorMessage = error.error?.message || t('feedback.communities.leaveError')
    });
  }

  transferOwnership(): void {
    if (!this.selected || !this.ownershipUsername.trim()) {
      return;
    }

    this.communityService.transferOwnership(
      this.selected.id,
      this.ownershipUsername.trim()
    ).subscribe({
      next: community => {
        this.selected = community;
        this.replaceCommunity(community);
        this.ownershipUsername = '';
      },
      error: error => this.errorMessage = error.error?.message || t('feedback.communities.transferError')
    });
  }

  onCommunityPhotoChange(event: Event): void {
    if (!this.selected || !this.canManage() || this.photoUpdating) {
      return;
    }

    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      this.errorMessage = t('feedback.image.choose');
      input.value = '';
      return;
    }

    this.photoUpdating = true;
    this.errorMessage = '';

    this.communityService.updatePhoto(this.selected.id, file)
      .pipe(finalize(() => {
        this.photoUpdating = false;
        input.value = '';
      }))
      .subscribe({
        next: community => {
          this.selected = community;
          this.replaceCommunity(community);
        },
        error: () => this.errorMessage = t('feedback.communities.photoError')
      });
  }

  communityInitials(community: CommunityGroup): string {
    return community.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map(part => part.charAt(0).toUpperCase())
      .join('') || '◎';
  }

  canManage(): boolean {
    return this.selected?.myRole === 'OWNER' || this.selected?.myRole === 'ADMIN';
  }

  isOwner(): boolean {
    return this.selected?.myRole === 'OWNER';
  }

  private refreshSelected(): void {
    if (!this.selected) {
      return;
    }

    this.communityService.get(this.selected.id).subscribe({
      next: community => {
        this.selected = community;
        this.replaceCommunity(community);
      }
    });
  }

  private replaceCommunity(community: CommunityGroup): void {
    this.communities = this.communities.map(item =>
      item.id === community.id ? community : item
    );
  }
}
