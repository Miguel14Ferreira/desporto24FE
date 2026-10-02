import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { finalize, retry, timeout } from 'rxjs';
import { appTranslate as t } from '../../i18n/i18n.service';

import {
  CommunityCompetitionOverview,
  CommunityGroup,
  CommunityInvite,
  CommunityMatchResult,
  CommunityRole,
  CommunitySeason,
  CommunityRound,
  CommunityRoundEntryDraft,
  CommunityStanding
} from '../model/community-group';
import { CommunityGroupsService } from '../../services/community-groups.service';
import { CommunityService } from '../../services/community.service';
import { CommunityProfile } from '../model/community-profile';
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
  inviteSearchResults: CommunityProfile[] = [];
  inviteSearchLoading = false;
  inviteSearchPerformed = false;
  inviteMessage = '';
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

  selectedSeasonId: number | null = null;
  seasonName = '';
  seasonStartsAt = '';
  seasonSaving = false;
  closeSeasonConfirming = false;

  compareUsernameA = '';
  compareUsernameB = '';

  constructor(
    private communityService: CommunityGroupsService,
    private profileService: CommunityService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loading = true;
    this.errorMessage = '';

    this.communityService.mine()
      .pipe(
        timeout(10_000),
        retry({ count: 1 }),
        finalize(() => this.loading = false)
      )
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

    this.communityService.myInvites()
      .pipe(
        timeout(10_000),
        retry({ count: 1 })
      )
      .subscribe({
        next: invites => this.invites = invites,
        error: () => this.invites = []
      });
  }

  open(community: CommunityGroup): void {
    this.errorMessage = '';

    this.communityService.get(community.id)
      .pipe(
        timeout(10_000),
        retry({ count: 1 })
      )
      .subscribe({
      next: full => {
        this.selected = full;
        this.activeTab = 'home';
        this.inviteUsername = '';
        this.inviteSearchResults = [];
        this.inviteSearchPerformed = false;
        this.inviteMessage = '';
        this.roundDeleteConfirmId = undefined;
        this.selectedSeasonId = null;
        this.closeSeasonConfirming = false;
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
      .pipe(
        timeout(10_000),
        retry({ count: 1 }),
        finalize(() => this.sessionsLoading = false)
      )
      .subscribe({
        next: sessions => this.communitySessions = sessions,
        error: () => {
          this.communitySessions = [];
          this.errorMessage = t('feedback.communities.sessionsLoadError');
        }
      });
  }

  loadCompetition(
    community: CommunityGroup = this.selected as CommunityGroup,
    seasonId: number | null = this.selectedSeasonId
  ): void {
    if (!community) {
      return;
    }

    this.competitionLoading = true;
    this.communityService.competition(community.id, seasonId)
      .pipe(
        timeout(10_000),
        retry({ count: 1 }),
        finalize(() => this.competitionLoading = false)
      )
      .subscribe({
        next: competition => {
          this.competition = competition;
          this.selectedSeasonId = competition.selectedSeasonId;
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

  selectSeason(value: string): void {
    if (!this.selected) {
      return;
    }

    const seasonId = value === '' ? null : Number(value);
    this.selectedSeasonId = seasonId !== null && Number.isFinite(seasonId)
      ? seasonId
      : null;
    this.loadCompetition(this.selected, this.selectedSeasonId);
  }

  createSeason(): void {
    if (!this.selected || !this.canManage() || this.seasonSaving || !this.seasonName.trim()) {
      return;
    }

    this.seasonSaving = true;
    this.errorMessage = '';

    let startsAt: string | null = null;
    if (this.seasonStartsAt) {
      const parsed = new Date(this.seasonStartsAt);
      if (Number.isNaN(parsed.getTime())) {
        this.errorMessage = t('feedback.communities.seasonDateInvalid');
        this.seasonSaving = false;
        return;
      }
      startsAt = parsed.toISOString();
    }

    this.communityService.createSeason(this.selected.id, {
      name: this.seasonName.trim(),
      startsAt
    })
      .pipe(
        timeout(10_000),
        finalize(() => this.seasonSaving = false)
      )
      .subscribe({
        next: season => {
          this.seasonName = '';
          this.seasonStartsAt = '';
          this.selectedSeasonId = season.id;
          this.loadCompetition(this.selected as CommunityGroup, season.id);
        },
        error: error => {
          this.errorMessage = error.error?.message
            || t('feedback.communities.seasonCreateError');
        }
      });
  }

  requestCloseSeason(): void {
    if (this.activeSeason()) {
      this.closeSeasonConfirming = true;
    }
  }

  cancelCloseSeason(): void {
    this.closeSeasonConfirming = false;
  }

  closeActiveSeason(): void {
    const active = this.activeSeason();
    if (!this.selected || !active || !this.canManage() || this.seasonSaving) {
      return;
    }

    this.seasonSaving = true;
    this.errorMessage = '';

    this.communityService.closeSeason(this.selected.id, active.id)
      .pipe(
        timeout(10_000),
        finalize(() => this.seasonSaving = false)
      )
      .subscribe({
        next: season => {
          this.closeSeasonConfirming = false;
          this.selectedSeasonId = season.id;
          this.loadCompetition(this.selected as CommunityGroup, season.id);
        },
        error: error => {
          this.errorMessage = error.error?.message
            || t('feedback.communities.seasonCloseError');
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
      .pipe(
        timeout(10_000),
        finalize(() => this.competitionSaving = false)
      )
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
          this.loadCompetition(updated, this.selectedSeasonId);
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
      team: '',
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
        team: entry.team.trim() || null,
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
      .pipe(
        timeout(10_000),
        finalize(() => this.roundSaving = false)
      )
      .subscribe({
        next: () => {
          this.roundName = '';
          this.roundPlayedAt = '';
          this.prepareRoundEntries();
          this.loadCompetition(this.selected as CommunityGroup, this.selectedSeasonId);
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
          this.loadCompetition(this.selected as CommunityGroup, this.selectedSeasonId);
        },
        error: error => {
          this.errorMessage = error.error?.message
            || t('feedback.communities.roundDeleteError');
        }
      });
  }

  searchInviteUsers(): void {
    const query = this.inviteUsername.trim();
    if (!this.selected || !query || this.inviteSearchLoading) {
      return;
    }

    this.inviteSearchLoading = true;
    this.inviteSearchPerformed = false;
    this.inviteSearchResults = [];
    this.inviteMessage = '';
    this.errorMessage = '';

    this.profileService.findProfiles({ name: query })
      .pipe(
        timeout(10_000),
        retry({ count: 1 }),
        finalize(() => this.inviteSearchLoading = false)
      )
      .subscribe({
        next: profiles => {
          const existingMembers = new Set(
            this.selected?.members.map(member => member.username.toLowerCase()) || []
          );

          this.inviteSearchResults = profiles
            .filter(profile => !existingMembers.has(profile.username.toLowerCase()))
            .slice(0, 8);
          this.inviteSearchPerformed = true;
        },
        error: () => {
          this.inviteSearchPerformed = true;
          this.errorMessage = t('feedback.communities.inviteSearchError');
        }
      });
  }

  selectInviteUser(profile: CommunityProfile): void {
    this.inviteUsername = profile.username;
    this.inviteSearchResults = [];
    this.inviteSearchPerformed = false;
    this.inviteMessage = '';
  }

  invite(): void {
    if (!this.selected || !this.inviteUsername.trim() || this.saving) {
      return;
    }

    const username = this.inviteUsername.trim();
    this.saving = true;
    this.errorMessage = '';
    this.inviteMessage = '';

    this.communityService.invite(this.selected.id, username)
      .pipe(
        timeout(10_000),
        finalize(() => this.saving = false)
      )
      .subscribe({
        next: () => {
          this.inviteUsername = '';
          this.inviteSearchResults = [];
          this.inviteSearchPerformed = false;
          this.inviteMessage = t('feedback.communities.inviteSent', { username });
        },
        error: error => {
          this.errorMessage = error.error?.message || t('feedback.communities.inviteError');
        }
      });
  }

  acceptInvite(invite: CommunityInvite): void {
    this.communityService.acceptInvite(invite.id)
      .pipe(timeout(10_000))
      .subscribe({
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
    this.communityService.rejectInvite(invite.id)
      .pipe(timeout(10_000))
      .subscribe({
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

  seasonOptionLabel(season: CommunitySeason): string {
    return season.active
      ? season.name + ' · ' + t('communities.activeShort')
      : season.name;
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

  activeSeason(): CommunitySeason | undefined {
    const activeId = this.competition?.activeSeasonId;
    return this.competition?.seasons.find(season => season.id === activeId);
  }

  trophies(): CommunitySeason[] {
    return (this.competition?.seasons || []).filter(
      season => !season.active && Boolean(season.championUsername)
    );
  }

  mostGames(): CommunityStanding | undefined {
    return this.topBy('games');
  }

  bestWinRate(): CommunityStanding | undefined {
    return this.topBy('winRate');
  }

  bestWinStreak(): CommunityStanding | undefined {
    return this.topBy('bestWinStreak');
  }

  comparePlayerA(): CommunityStanding | undefined {
    return this.competition?.standings.find(
      row => row.username === this.compareUsernameA
    );
  }

  comparePlayerB(): CommunityStanding | undefined {
    return this.competition?.standings.find(
      row => row.username === this.compareUsernameB
    );
  }

  pointsBarWidth(row: CommunityStanding): number {
    const standings = this.competition?.standings || [];
    const maxPoints = Math.max(0, ...standings.map(item => item.points));
    if (maxPoints <= 0) {
      return 0;
    }
    return Math.max(4, Math.round((row.points / maxPoints) * 100));
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

  private topBy(
    field: 'games' | 'goals' | 'assists' | 'mvps' | 'cleanSheets' | 'winRate' | 'bestWinStreak'
  ): CommunityStanding | undefined {
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
