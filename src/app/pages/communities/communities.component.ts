import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { finalize } from 'rxjs';
import { appTranslate as t } from '../../i18n/i18n.service';

import {
  CommunityCompetitionOverview,
  CommunityGroup,
  CommunityInvite,
  CommunityMatchResult,
  CommunityRole,
  CommunityRound,
  CommunityRoundEntryDraft,
  CommunityStanding
} from '../model/community-group';
import { CommunityGroupsService } from '../../services/community-groups.service';
import { SessionSummary } from '../model/session-summary';

type CommunityTab = 'home' | 'sessions' | 'ranking' | 'stats' | 'members';

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
  competition?: CommunityCompetitionOverview;
  communitySessions: SessionSummary[] = [];

  loading = false;
  saving = false;
  competitionLoading = false;
  sessionsLoading = false;
  competitionSaving = false;
  roundSaving = false;
  errorMessage = '';

  activeTab: CommunityTab = 'home';
  inviteUsername = '';
  ownershipUsername = '';
  photoUpdating = false;

  rankingsEnabledDraft = false;
  winPointsDraft = 3;
  drawPointsDraft = 1;
  lossPointsDraft = 0;

  roundName = '';
  roundPlayedAt = '';
  roundEntries: CommunityRoundEntryDraft[] = [];
  roundDeleteConfirmId?: number;

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
            const refreshed = communities.find(item => item.id === this.selected?.id);
            if (refreshed) {
              this.open(refreshed);
            }
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
    this.errorMessage = '';

    this.communityService.get(community.id).subscribe({
      next: full => {
        this.selected = full;
        this.activeTab = 'home';
        this.roundDeleteConfirmId = undefined;
        this.prepareRoundEntries(full);
        this.loadCompetition(full);
        this.loadCommunitySessions(full);
      },
      error: () => this.errorMessage = t('feedback.communities.openError')
    });
  }

  setTab(tab: CommunityTab): void {
    this.activeTab = tab;
    this.errorMessage = '';
  }

  loadCommunitySessions(community: CommunityGroup = this.selected as CommunityGroup): void {
    if (!community) {
      this.communitySessions = [];
      return;
    }

    this.sessionsLoading = true;
    this.communityService.sessions(community.id)
      .pipe(finalize(() => this.sessionsLoading = false))
      .subscribe({
        next: sessions => this.communitySessions = sessions,
        error: () => {
          this.communitySessions = [];
          this.errorMessage = t('feedback.communities.sessionsLoadError');
        }
      });
  }

  loadCompetition(community: CommunityGroup = this.selected as CommunityGroup): void {
    if (!community) {
      return;
    }

    this.competitionLoading = true;
    this.communityService.competition(community.id)
      .pipe(finalize(() => this.competitionLoading = false))
      .subscribe({
        next: competition => {
          this.competition = competition;
          this.rankingsEnabledDraft = competition.settings.rankingsEnabled;
          this.winPointsDraft = competition.settings.winPoints;
          this.drawPointsDraft = competition.settings.drawPoints;
          this.lossPointsDraft = competition.settings.lossPoints;
        },
        error: () => {
          this.competition = undefined;
          this.errorMessage = t('feedback.communities.competitionLoadError');
        }
      });
  }

  saveCompetitionSettings(): void {
    if (!this.selected || !this.canManage() || this.competitionSaving) {
      return;
    }

    this.competitionSaving = true;
    this.errorMessage = '';

    this.communityService.updateCompetitionSettings(this.selected.id, {
      rankingsEnabled: this.rankingsEnabledDraft,
      winPoints: Math.max(0, Number(this.winPointsDraft) || 0),
      drawPoints: Math.max(0, Number(this.drawPointsDraft) || 0),
      lossPoints: Math.max(0, Number(this.lossPointsDraft) || 0)
    })
      .pipe(finalize(() => this.competitionSaving = false))
      .subscribe({
        next: settings => {
          if (this.competition) {
            this.competition = {
              ...this.competition,
              settings
            };
          }

          const updated = {
            ...this.selected as CommunityGroup,
            rankingsEnabled: settings.rankingsEnabled
          };
          this.selected = updated;
          this.replaceCommunity(updated);
          this.loadCompetition(updated);
        },
        error: error => {
          this.errorMessage = error.error?.message
            || t('feedback.communities.competitionSettingsError');
        }
      });
  }

  prepareRoundEntries(community: CommunityGroup = this.selected as CommunityGroup): void {
    if (!community) {
      this.roundEntries = [];
      return;
    }

    this.roundEntries = community.members.map(member => ({
      username: member.username,
      included: false,
      result: 'WIN' as CommunityMatchResult,
      goals: 0,
      assists: 0,
      mvp: false,
      cleanSheet: false
    }));
  }

  createRound(): void {
    if (!this.selected || !this.canManage() || this.roundSaving) {
      return;
    }

    const entries = this.roundEntries
      .filter(entry => entry.included)
      .map(entry => ({
        username: entry.username,
        result: entry.result,
        goals: Math.max(0, Number(entry.goals) || 0),
        assists: Math.max(0, Number(entry.assists) || 0),
        mvp: Boolean(entry.mvp),
        cleanSheet: Boolean(entry.cleanSheet)
      }));

    if (!this.roundName.trim() || !this.roundPlayedAt || entries.length === 0) {
      this.errorMessage = t('feedback.communities.roundRequired');
      return;
    }

    const playedAt = new Date(this.roundPlayedAt);
    if (Number.isNaN(playedAt.getTime())) {
      this.errorMessage = t('feedback.communities.roundRequired');
      return;
    }

    this.roundSaving = true;
    this.errorMessage = '';

    this.communityService.createRound(this.selected.id, {
      name: this.roundName.trim(),
      playedAt: playedAt.toISOString(),
      entries
    })
      .pipe(finalize(() => this.roundSaving = false))
      .subscribe({
        next: () => {
          this.roundName = '';
          this.roundPlayedAt = '';
          this.prepareRoundEntries();
          this.loadCompetition();
        },
        error: error => {
          this.errorMessage = error.error?.message
            || t('feedback.communities.roundSaveError');
        }
      });
  }

  askDeleteRound(round: CommunityRound): void {
    this.roundDeleteConfirmId = round.id;
  }

  cancelDeleteRound(): void {
    this.roundDeleteConfirmId = undefined;
  }

  deleteRound(round: CommunityRound): void {
    if (!this.selected || !this.canManage() || this.roundSaving) {
      return;
    }

    this.roundSaving = true;
    this.errorMessage = '';

    this.communityService.deleteRound(this.selected.id, round.id)
      .pipe(finalize(() => this.roundSaving = false))
      .subscribe({
        next: () => {
          this.roundDeleteConfirmId = undefined;
          this.loadCompetition();
        },
        error: error => {
          this.errorMessage = error.error?.message
            || t('feedback.communities.roundDeleteError');
        }
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
        this.activeTab = 'home';
        this.prepareRoundEntries(community);
        this.loadCompetition(community);
        this.loadCommunitySessions(community);
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
        this.prepareRoundEntries(community);
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
        this.competition = undefined;
        this.communitySessions = [];
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

  formatSessionDate(value: string): string {
    const parsed = Date.parse(value);
    if (Number.isNaN(parsed)) {
      return value;
    }

    return new Intl.DateTimeFormat('pt-PT', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(parsed));
  }

  formatRoundDate(value: string): string {
    const parsed = Date.parse(value);
    if (Number.isNaN(parsed)) {
      return value;
    }

    return new Intl.DateTimeFormat('pt-PT', {
      dateStyle: 'medium'
    }).format(new Date(parsed));
  }

  resultLabel(result: CommunityMatchResult): string {
    switch (result) {
      case 'WIN':
        return t('communities.result.win');
      case 'DRAW':
        return t('communities.result.draw');
      case 'LOSS':
        return t('communities.result.loss');
    }
  }

  leader(): CommunityStanding | undefined {
    return this.competition?.standings[0];
  }

  topGoals(): CommunityStanding | undefined {
    return this.topBy('goals');
  }

  topAssists(): CommunityStanding | undefined {
    return this.topBy('assists');
  }

  topMvps(): CommunityStanding | undefined {
    return this.topBy('mvps');
  }

  topCleanSheets(): CommunityStanding | undefined {
    return this.topBy('cleanSheets');
  }

  canManage(): boolean {
    return this.selected?.myRole === 'OWNER' || this.selected?.myRole === 'ADMIN';
  }

  isOwner(): boolean {
    return this.selected?.myRole === 'OWNER';
  }

  private topBy(field: 'goals' | 'assists' | 'mvps' | 'cleanSheets'): CommunityStanding | undefined {
    const rows = this.competition?.standings || [];
    if (rows.length === 0) {
      return undefined;
    }

    return [...rows].sort((a, b) =>
      b[field] - a[field] || a.position - b.position
    )[0];
  }

  private refreshSelected(): void {
    if (!this.selected) {
      return;
    }

    this.communityService.get(this.selected.id).subscribe({
      next: community => {
        this.selected = community;
        this.replaceCommunity(community);
        this.prepareRoundEntries(community);
        this.loadCompetition(community);
        this.loadCommunitySessions(community);
      }
    });
  }

  private replaceCommunity(community: CommunityGroup): void {
    this.communities = this.communities.map(item =>
      item.id === community.id ? community : item
    );
  }
}
