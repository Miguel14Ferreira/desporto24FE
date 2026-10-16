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
  step: 'invite' | 'competition' = 'invite';
  competitionChoice: boolean | null = null;
  competitionSaving = false;
  competitionError = '';

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

  continueAfterInvite(): void {
    if (!this.community || !this.canGenerate()) {
      this.continueToCommunity();
      return;
    }
    this.competitionError = '';
    this.step = 'competition';
  }

  backToInvite(): void {
    if (!this.competitionSaving) {
      this.step = 'invite';
    }
  }

  selectCompetition(enabled: boolean): void {
    if (this.competitionSaving || !this.canGenerate()) return;
    this.competitionChoice = enabled;
    this.competitionError = '';
  }

  saveCompetitionAndContinue(): void {
    if (!this.community || !this.canGenerate() || this.competitionChoice === null
        || this.competitionSaving) return;

    this.competitionSaving = true;
    this.competitionError = '';
    this.groups.updateCompetitionSettings(this.community.id, {
      rankingsEnabled: this.competitionChoice,
      winPoints: null,
      drawPoints: null,
      lossPoints: null
    }).pipe(timeout(10_000), finalize(() => this.competitionSaving = false))
      .subscribe({
        next: () => this.continueToCommunity(),
        error: () => this.competitionError = t('communityInviteStep.competitionSaveError')
      });
  }

  continueToCommunity(): void {
    if (this.communityId > 0) {
      void this.router.navigate(['/menu/communities', this.communityId]);
    } else {
      void this.router.navigate(['/menu/communities']);
    }
  }
}
