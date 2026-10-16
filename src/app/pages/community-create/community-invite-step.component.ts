import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize, timeout } from 'rxjs';

import { appTranslate as t } from '../../i18n/i18n.service';
import { CommunityGroupsService } from '../../services/community-groups.service';
import { buildCommunityGroupInviteUrl, buildWhatsAppGroupShareUrl } from '../communities/community-group-invite';
import { CommunityGroup } from '../model/community-group';

@Component({
  selector: 'app-community-invite-step',
  templateUrl: './community-invite-step.component.html',
  styleUrls: ['./community-invite-step.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false
})
export class CommunityInviteStepComponent implements OnInit {
  communityId = 0;
  community?: CommunityGroup;
  loading = true;
  loadError = false;
  inviteLink = '';
  copyFeedback = '';

  constructor(
    private readonly route: ActivatedRoute,
    private readonly groups: CommunityGroupsService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!Number.isSafeInteger(id) || id <= 0) {
      this.loading = false;
      this.loadError = true;
      return;
    }

    this.communityId = id;
    this.groups.get(id)
      .pipe(timeout(10_000), finalize(() => this.loading = false))
      .subscribe({
        next: community => this.community = community,
        error: () => this.loadError = true
      });
  }

  canGenerate(): boolean {
    return this.community?.myRole === 'OWNER' || this.community?.myRole === 'ADMIN';
  }

  generateLink(): void {
    if (!this.community || !this.canGenerate()) return;
    this.inviteLink = buildCommunityGroupInviteUrl(window.location.origin, this.community.id);
    this.copyFeedback = '';
  }

  whatsAppShareUrl(): string {
    if (!this.community || !this.inviteLink) return '';
    const message = [
      t('communityInviteStep.message', { name: this.community.name }),
      t(this.community.visibility === 'PRIVATE'
        ? 'communityInviteStep.messagePrivate'
        : 'communityInviteStep.messagePublic'),
      this.inviteLink
    ].join('\n\n');
    return buildWhatsAppGroupShareUrl(message);
  }

  async copyLink(): Promise<void> {
    if (!this.inviteLink || !this.canGenerate()) return;
    try {
      await navigator.clipboard.writeText(this.inviteLink);
      this.copyFeedback = t('communityInviteStep.copied');
    } catch {
      this.copyFeedback = t('communityInviteStep.copyError');
    }
  }

  continueToCommunity(): void {
    if (this.communityId > 0) {
      void this.router.navigate(['/menu/communities', this.communityId]);
    } else {
      void this.router.navigate(['/menu/communities']);
    }
  }
}
