import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize, Observable, retry, timeout } from 'rxjs';
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
import {
  CommunityGroupsService,
  CommunityJoinRequest,
  CommunitySearchPresentation
} from '../../services/community-groups.service';
import { CommunityService } from '../../services/community.service';
import { SessionService } from '../../services/session.service';
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
  openingSessionId?: number;
  joiningSessionId?: number;
  competitionSaving = false;
  roundSaving = false;
  errorMessage = '';

  activeTab: CommunityTab = 'home';
  inviteUsername = '';
  inviteSearchResults: CommunityProfile[] = [];
  inviteSearchLoading = false;
  inviteSearchPerformed = false;
  inviteMessage = '';
  pendingJoinRequests: CommunityJoinRequest[] = [];
  pendingJoinRequestsLoading = false;
  joinRequestActionId?: number;
  ownershipUsername = '';
  photoUpdating = false;

  communitySearchName = '';
  communitySearchSport = '';
  communitySearchResults: CommunitySearchPresentation[] = [];
  communitySearchPage = 0;
  communitySearchHasMore = false;
  communitySearchLoading = false;
  communitySearchPerformed = false;
  communitySearchError = '';
  communityPresentation?: CommunitySearchPresentation;
  presentationLoading = false;
  membershipActionLoading = false;
  membershipActionMessage = '';
  joinRequestSent = false;

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

  importFile?: File;
  importFileName = '';
  importFileError = '';
  importPreviewLoading = false;
  importSheetName = '';
  importMappings: Array<{ columnIndex: number; header: string; field: string; confidence: number }> = [];
  importValidation?: { valid: boolean; dataRows: number; validRows: number; errors: string[]; warnings: string[] };
  importNormalized?: { acceptedRows: number; skippedRows: number; rows: any[]; skipped: any[] };
  importMappingLoading = false;
  importDefaultYear: number | null = new Date().getFullYear();
  importPlanLoading = false;
  importFinalPlan?: any;
  importConfirming = false;
  importResult?: { createdRounds: number; skippedDuplicateRounds: number; createdEntries: number };
  readonly importFields = ['IGNORE', 'PLAYER', 'DATE', 'RESULT', 'WIN', 'DRAW', 'LOSS', 'GOALS', 'ASSISTS', 'POINTS', 'MVP'];
  importPreview?: {
    fileName: string;
    sheets: Array<{
      name: string;
      nonEmptyRows: number;
      structure: string;
      headers: string[];
      sampleRows: string[][];
      columnSuggestions: Array<{
        columnIndex: number;
        header: string;
        field: string;
        confidence: number;
      }>;
    }>;
  };

  compareUsernameA = '';
  compareUsernameB = '';

  constructor(
    private communityService: CommunityGroupsService,
    private profileService: CommunityService,
    private sessionService: SessionService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.reload();
  }

  detailMode(): boolean {
    return Boolean(this.route.snapshot.paramMap.get('id'));
  }

  backToCommunities(): void {
    void this.router.navigate(['/menu/communities']);
  }

  searchCommunities(page = 0): void {
    const name = this.communitySearchName.trim();
    const sport = this.communitySearchSport.trim();
    if (!name && !sport) {
      this.clearCommunitySearch();
      return;
    }

    this.communitySearchLoading = true;
    this.communitySearchError = '';
    this.communityService.search(name, sport, page)
      .pipe(
        timeout(10_000),
        retry({ count: 1 }),
        finalize(() => this.communitySearchLoading = false)
      )
      .subscribe({
        next: result => {
          this.communitySearchResults = result.communities;
          this.communitySearchPage = result.page;
          this.communitySearchHasMore = result.hasMore;
          this.communitySearchPerformed = true;
        },
        error: () => {
          this.communitySearchResults = [];
          this.communitySearchHasMore = false;
          this.communitySearchPerformed = true;
          this.communitySearchError = t('feedback.communities.searchError');
        }
      });
  }

  changeCommunitySearchPage(direction: number): void {
    if (this.communitySearchLoading || (direction < 0 && this.communitySearchPage === 0)
        || (direction > 0 && !this.communitySearchHasMore)) {
      return;
    }
    this.searchCommunities(this.communitySearchPage + direction);
  }

  clearCommunitySearch(): void {
    this.communitySearchName = '';
    this.communitySearchSport = '';
    this.communitySearchResults = [];
    this.communitySearchPage = 0;
    this.communitySearchHasMore = false;
    this.communitySearchPerformed = false;
    this.communitySearchError = '';
  }

  openCommunityPresentation(community: CommunitySearchPresentation): void {
    void this.router.navigate(['/menu/communities', community.id]);
  }

  private loadCommunityPresentation(id: number): void {
    this.selected = undefined;
    this.communityPresentation = undefined;
    this.presentationLoading = true;
    this.membershipActionMessage = '';
    this.joinRequestSent = false;
    this.errorMessage = '';

    this.communityService.presentation(id)
      .pipe(
        timeout(10_000),
        retry({ count: 1 }),
        finalize(() => this.presentationLoading = false)
      )
      .subscribe({
        next: presentation => {
          this.communityPresentation = presentation;
          if (presentation.visibility === 'PRIVATE') {
            this.loadMyPendingJoinRequest(presentation.id);
          }
        },
        error: () => this.errorMessage = t('feedback.communities.openError')
      });
  }

  private loadMyPendingJoinRequest(communityId: number): void {
    this.communityService.myPendingJoinRequest(communityId)
      .pipe(timeout(10_000))
      .subscribe({
        next: request => {
          if (this.communityPresentation?.id !== communityId) {
            return;
          }

          this.joinRequestSent = Boolean(request);
          this.membershipActionMessage = request
            ? t('communities.joinRequestSent')
            : '';
        },
        error: () => {
          if (this.communityPresentation?.id === communityId) {
            this.joinRequestSent = false;
            this.membershipActionMessage = '';
          }
        }
      });
  }

  joinPresentedCommunity(): void {
    const community = this.communityPresentation;
    if (!community || this.membershipActionLoading || this.joinRequestSent) {
      return;
    }

    this.membershipActionLoading = true;
    this.membershipActionMessage = '';
    this.errorMessage = '';

    const action: Observable<unknown> = community.visibility === 'PUBLIC'
      ? this.communityService.joinPublic(community.id)
      : this.communityService.requestJoin(community.id);

    action
      .pipe(
        timeout(10_000),
        finalize(() => this.membershipActionLoading = false)
      )
      .subscribe({
        next: () => {
          if (community.visibility === 'PUBLIC') {
            this.reload();
            return;
          }

          this.joinRequestSent = true;
          this.membershipActionMessage = t('communities.joinRequestSent');
        },
        error: error => {
          this.errorMessage = error.error?.message
            || t('feedback.communities.joinError');
        }
      });
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

          const routeId = this.route.snapshot.paramMap.get('id');
          const requestedId = Number(routeId || this.route.snapshot.queryParamMap.get('community'));
          if (requestedId && !Number.isNaN(requestedId)) {
            const requested = communities.find(item => item.id === requestedId);
            if (requested) {
              this.communityPresentation = undefined;
              this.open(requested);
              return;
            }
            if (this.detailMode()) {
              this.loadCommunityPresentation(requestedId);
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
    if (!this.detailMode()) {
      void this.router.navigate(['/menu/communities', community.id]);
      return;
    }

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

    if (tab === 'members' && this.selected && this.canManage()) {
      this.loadPendingJoinRequests(this.selected.id);
    }
  }

  private loadPendingJoinRequests(communityId: number): void {
    this.pendingJoinRequestsLoading = true;
    this.communityService.pendingJoinRequests(communityId)
      .pipe(
        timeout(10_000),
        finalize(() => this.pendingJoinRequestsLoading = false)
      )
      .subscribe({
        next: requests => this.pendingJoinRequests = requests,
        error: () => {
          this.pendingJoinRequests = [];
          this.errorMessage = t('feedback.communities.joinRequestsLoadError');
        }
      });
  }

  acceptPendingJoinRequest(request: CommunityJoinRequest): void {
    if (!this.selected || this.joinRequestActionId !== undefined) {
      return;
    }

    this.joinRequestActionId = request.id;
    this.errorMessage = '';

    this.communityService.acceptJoinRequest(this.selected.id, request.id)
      .pipe(
        timeout(10_000),
        finalize(() => this.joinRequestActionId = undefined)
      )
      .subscribe({
        next: () => {
          this.pendingJoinRequests = this.pendingJoinRequests.filter(item => item.id !== request.id);
          this.refreshSelected();
        },
        error: error => {
          this.errorMessage = error.error?.message
            || t('feedback.communities.joinRequestActionError');
        }
      });
  }

  rejectPendingJoinRequest(request: CommunityJoinRequest): void {
    if (!this.selected || this.joinRequestActionId !== undefined) {
      return;
    }

    this.joinRequestActionId = request.id;
    this.errorMessage = '';

    this.communityService.rejectJoinRequest(this.selected.id, request.id)
      .pipe(
        timeout(10_000),
        finalize(() => this.joinRequestActionId = undefined)
      )
      .subscribe({
        next: () => {
          this.pendingJoinRequests = this.pendingJoinRequests.filter(item => item.id !== request.id);
        },
        error: error => {
          this.errorMessage = error.error?.message
            || t('feedback.communities.joinRequestActionError');
        }
      });
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

  joinCommunitySession(session: SessionSummary): void {
    if (!this.selected || this.joiningSessionId !== undefined
        || session.participantCount >= session.maxParticipants
        || session.privateGame) {
      return;
    }

    const communityId = this.selected.id;
    this.joiningSessionId = session.id;
    this.errorMessage = '';

    this.sessionService.join(session.id)
      .pipe(
        timeout(10_000),
        finalize(() => this.joiningSessionId = undefined)
      )
      .subscribe({
        next: () => {
          if (this.selected?.id === communityId) {
            this.loadCommunitySessions(this.selected);
          }
        },
        error: error => {
          if (this.selected?.id === communityId) {
            this.errorMessage = error.error?.message
              || t('feedback.communities.joinSessionError');
          }
        }
      });
  }

  openSessionToPublic(session: SessionSummary): void {
    if (!this.selected || !this.canManage() || session.audience !== 'COMMUNITY_ONLY'
        || this.openingSessionId !== undefined) {
      return;
    }

    const communityId = this.selected.id;
    this.openingSessionId = session.id;
    this.errorMessage = '';
    this.communityService.openSessionToPublic(communityId, session.id)
      .pipe(
        timeout(10_000),
        finalize(() => this.openingSessionId = undefined)
      )
      .subscribe({
        next: updated => {
          if (this.selected?.id === communityId) {
            this.communitySessions = this.communitySessions.map(item =>
              item.id === updated.id ? updated : item
            );
          }
        },
        error: () => {
          if (this.selected?.id === communityId) {
            this.errorMessage = t('feedback.communities.openPublicError');
          }
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
    if (this.seasonSaving) {
      return;
    }

    if (!this.selected || !this.canManage()) {
      this.errorMessage = t('feedback.communities.seasonCreateError');
      return;
    }

    const name = this.seasonName.trim();
    if (!name) {
      this.errorMessage = t('feedback.communities.seasonCreateError');
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
      name,
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

  private resetImportAfterFile(): void {
    this.importSheetName = '';
    this.importMappings = [];
    this.importValidation = undefined;
    this.importNormalized = undefined;
    this.importFinalPlan = undefined;
    this.importResult = undefined;
  }

  private resetImportAfterMapping(): void {
    this.importValidation = undefined;
    this.importNormalized = undefined;
    this.importFinalPlan = undefined;
    this.importResult = undefined;
  }

  onImportFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    this.importFileError = '';

    if (!file) {
      this.importFile = undefined;
      this.importFileName = '';
      return;
    }

    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      this.importFile = undefined;
      this.importFileName = '';
      this.importFileError = t('communities.import.invalidFile');
      input.value = '';
      return;
    }

    this.importFile = file;
    this.importFileName = file.name;
    this.importPreview = undefined;
    this.resetImportAfterFile();
  }

  clearImportFile(input: HTMLInputElement): void {
    this.importFile = undefined;
    this.importFileName = '';
    this.importFileError = '';
    this.importPreview = undefined;
    this.resetImportAfterFile();
    input.value = '';
  }

  inspectImportFile(): void {
    if (!this.selected || !this.importFile || this.importPreviewLoading) {
      return;
    }

    this.importPreviewLoading = true;
    this.importFileError = '';
    this.importPreview = undefined;

    this.communityService.importPreview(this.selected.id, this.importFile)
      .pipe(
        timeout(20_000),
        finalize(() => this.importPreviewLoading = false)
      )
      .subscribe({
        next: preview => {
          this.importPreview = preview;
          const sheet = preview.sheets.find(item => item.structure === 'TABULAR') || preview.sheets[0];
          this.selectImportSheet(sheet?.name || '');
        },
        error: error => {
          this.importFileError = error.error?.message || t('communities.import.inspectError');
        }
      });
  }

  selectImportSheet(sheetName: string): void {
    this.importSheetName = sheetName;
    this.resetImportAfterMapping();
    const sheet = this.importPreview?.sheets.find(item => item.name === sheetName);
    if (!sheet) {
      this.importMappings = [];
      return;
    }

    const suggestions = new Map(
      sheet.columnSuggestions.map(item => [item.columnIndex, item])
    );
    this.importMappings = sheet.headers.map((header, columnIndex) => {
      const suggestion = suggestions.get(columnIndex);
      return {
        columnIndex,
        header,
        field: suggestion?.field || 'IGNORE',
        confidence: suggestion?.confidence || 0
      };
    });
  }

  setImportMapping(columnIndex: number, field: string): void {
    const mapping = this.importMappings.find(item => item.columnIndex === columnIndex);
    if (mapping) {
      mapping.field = field;
      this.resetImportAfterMapping();
    }
  }

  validateImportMapping(): void {
    if (!this.selected || !this.importFile || !this.importSheetName || this.importMappingLoading) return;

    const mapping = {
      sheetName: this.importSheetName,
      columns: this.importMappings.map(item => ({
        columnIndex: item.columnIndex,
        field: item.field
      }))
    };

    this.importMappingLoading = true;
    this.importFileError = '';
    this.importValidation = undefined;
    this.importNormalized = undefined;

    this.communityService.validateImport(this.selected.id, this.importFile, mapping)
      .pipe(timeout(20_000))
      .subscribe({
        next: validation => {
          this.importValidation = validation;
          if (!validation.valid) {
            this.importMappingLoading = false;
            return;
          }
          this.communityService.normalizedImportPreview(this.selected!.id, this.importFile!, mapping)
            .pipe(
              timeout(20_000),
              finalize(() => this.importMappingLoading = false)
            )
            .subscribe({
              next: preview => this.importNormalized = preview,
              error: error => this.importFileError = error.error?.message || t('communities.import.normalizeError')
            });
        },
        error: error => {
          this.importMappingLoading = false;
          this.importFileError = error.error?.message || t('communities.import.validateError');
        }
      });
  }

  invalidateImportPlan(): void {
    this.importFinalPlan = undefined;
    this.importResult = undefined;
    this.importFileError = '';
  }

  buildImportFinalPlan(): void {
    if (!this.selected || !this.importFile || !this.importSheetName || !this.selectedSeasonId || this.importPlanLoading) {
      this.importFileError = t('communities.import.seasonRequired');
      return;
    }
    const mapping = {
      sheetName: this.importSheetName,
      columns: this.importMappings.map(item => ({ columnIndex: item.columnIndex, field: item.field }))
    };
    const context = {
      seasonId: this.selectedSeasonId,
      defaultYear: this.importDefaultYear || null
    };

    this.importPlanLoading = true;
    this.importFileError = '';
    this.importFinalPlan = undefined;
    this.importResult = undefined;
    this.communityService.finalImportPlan(this.selected.id, this.importFile, mapping, context)
      .pipe(timeout(20_000), finalize(() => this.importPlanLoading = false))
      .subscribe({
        next: plan => this.importFinalPlan = plan,
        error: error => this.importFileError = error.error?.message || t('communities.import.planError')
      });
  }

  confirmHistoricalImport(): void {
    if (!this.selected || !this.importFile || !this.importSheetName || !this.selectedSeasonId || !this.importFinalPlan || this.importConfirming) return;
    if (this.importFinalPlan.invalidDates > 0 || this.importFinalPlan.roundsNeedingYear > 0 ||
        this.importFinalPlan.rounds.some((round: any) => round.unresolvedResults > 0)) {
      this.importFileError = t('communities.import.notReady');
      return;
    }
    const mapping = { sheetName: this.importSheetName, columns: this.importMappings.map(item => ({ columnIndex: item.columnIndex, field: item.field })) };
    const context = { seasonId: this.selectedSeasonId, defaultYear: this.importDefaultYear || null };
    this.importConfirming = true;
    this.importFileError = '';
    this.importResult = undefined;
    this.communityService.confirmImportRounds(this.selected.id, this.importFile, mapping, context)
      .pipe(timeout(30_000), finalize(() => this.importConfirming = false))
      .subscribe({
        next: result => {
          this.importResult = result;
          this.loadCompetition(this.selected!, this.selectedSeasonId);
        },
        error: error => this.importFileError = error.error?.message || t('communities.import.confirmError')
      });
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
      .pipe(
        timeout(10_000),
        finalize(() => this.roundSaving = false)
      )
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

    this.communityService.updateRole(this.selected.id, username, role)
      .pipe(timeout(10_000))
      .subscribe({
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

    this.communityService.removeMember(this.selected.id, username)
      .pipe(timeout(10_000))
      .subscribe({
      next: () => this.refreshSelected(),
      error: () => this.errorMessage = t('feedback.communities.removeError')
    });
  }

  leave(): void {
    if (!this.selected) {
      return;
    }

    const id = this.selected.id;
    this.communityService.leave(id)
      .pipe(timeout(10_000))
      .subscribe({
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
    )
      .pipe(timeout(10_000))
      .subscribe({
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
      .pipe(
        timeout(10_000),
        finalize(() => {
          this.photoUpdating = false;
          input.value = '';
        })
      )
      .subscribe({
        next: community => {
          this.selected = community;
          this.replaceCommunity(community);
        },
        error: () => this.errorMessage = t('feedback.communities.photoError')
      });
  }

  removeCommunityPhoto(): void {
    if (!this.selected || !this.selected.photoUrl || !this.canManage() || this.photoUpdating) {
      return;
    }

    this.photoUpdating = true;
    this.errorMessage = '';

    this.communityService.removePhoto(this.selected.id)
      .pipe(
        timeout(10_000),
        finalize(() => this.photoUpdating = false)
      )
      .subscribe({
        next: community => {
          this.selected = community;
          this.replaceCommunity(community);
        },
        error: () => this.errorMessage = t('feedback.communities.photoRemoveError')
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

    this.communityService.get(this.selected.id)
      .pipe(
        timeout(10_000),
        retry({ count: 1 })
      )
      .subscribe({
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
