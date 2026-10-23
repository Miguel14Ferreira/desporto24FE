import { AfterViewChecked, ChangeDetectionStrategy, Component, ElementRef, HostListener, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { JwtHelperService } from '@auth0/angular-jwt';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize, firstValueFrom, Observable, retry, timeout, Subscription, TimeoutError } from 'rxjs';
import { appTranslate as t } from '../../i18n/i18n.service';
import { buildCommunityGroupInviteUrl, buildWhatsAppGroupShareUrl } from './community-group-invite';
import { communityRoundMatchup, CommunityRoundMatchup } from './community-round-matchup';
import { sportForRound, CommunityRoundView } from './community-round-sport';
import { eventOptionsForSport, eventView, isNeutralEvent, eventPresentationFormat,
  CommunityEventType } from './community-round-event-type';
import { athleticsDisciplineOptions, athleticsDisciplineValid } from './community-field-disciplines';
import { breakingBattleError } from './community-breaking-battle';
import { raceSupportsLaps, formatRaceSeconds, raceEntryValidationError } from './community-race-metrics';
import { raceDecisionError } from './community-race-decisions';
import { performanceKind, performanceError, eventPerformanceEntries,
  eventPerformancePlace, performanceDisplay, surfWaveError, surfWaveTotal,
  isWaveHeatEvent } from './community-performance-results';
import { racketSupportsSets, racketUsesPointsPerSet, racketMatchWinner, recordedRacketMatch } from './community-racket-results';

import {
  CommunityCompetitionOverview,
  CommunityGroup,
  CommunityInvite,
  CommunityMatchResult,
  CommunityRole,
  CommunitySeason,
  CommunityRound,
  CommunityRoundEntry,
  CommunityRoundEntryDraft,
  CommunityStanding,
  CommunityRacketStandingGroup,
  CommunityRaceStandingGroup
} from '../model/community-group';
import {
  CommunityGroupsService,
  CommunityJoinRequest,
  CommunitySearchPresentation,
  HistoricalStandingPreview,
  HistoricalStandingSummary,
  HistoricalStandingArchive,
  HistoricalMatchPreview,
  HistoricalMatchArchive,
  HistoricalMatchArchiveSummary,
  HistoricalPlayerCandidate,
  HistoricalPlayerLink
} from '../../services/community-groups.service';
import { CommunityService } from '../../services/community.service';
import { SessionService } from '../../services/session.service';
import { CommunityTimelineService, CommunityTimelineEntry, CommunityTimelineKind } from '../../services/community-timeline.service';
import { DirectChatRealtimeService } from '../../services/direct-chat-realtime.service';
import { ChatTypingTracker } from '../../services/chat-typing-tracker';
import { chatContinuesGroup, chatDaySeparator } from '../../shared/chat-thread-presentation';
import { ChatReadSyncService } from '../../services/chat-read-sync.service';
import { CommunityProfile } from '../model/community-profile';
import { SessionSummary } from '../model/session-summary';
import { SPORTS_CATALOG } from '../../shared/sports-catalog';

type CommunityTab = 'home' | 'feed' | 'chat' | 'sessions' | 'tournaments' | 'ranking' | 'stats' | 'members';

@Component({
  selector: 'app-communities',
  templateUrl: './communities.component.html',
  styleUrls: ['./communities.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false
})
export class CommunitiesComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('communitySearchSection') communitySearchSection?: ElementRef<HTMLElement>;
  @ViewChild('communityChatLog') communityChatLog?: ElementRef<HTMLElement>;
  @ViewChild('communityComposer') communityComposer?: ElementRef<HTMLTextAreaElement>;
  private readonly realtimeService = inject(DirectChatRealtimeService);
  readonly typing = new ChatTypingTracker(this.realtimeService);
  private readonly readSync = inject(ChatReadSyncService);
  private readonly chatSubscriptions = new Subscription();
  private readonly jwtHelper = new JwtHelperService();

  private readonly sessionDateFormatter = new Intl.DateTimeFormat('pt-PT', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
  private readonly roundDateFormatter = new Intl.DateTimeFormat('pt-PT', {
    dateStyle: 'medium'
  });

  communities: CommunityGroup[] = [];
  invites: CommunityInvite[] = [];
  selected?: CommunityGroup;
  readonly sportsCatalog = SPORTS_CATALOG;
  sportsDraft: string[] = [];
  sportsSearch = '';
  editingSports = false;
  savingSports = false;
  sportsMessage = '';
  competition?: CommunityCompetitionOverview;
  raceRuleSport: string | null = null;
  raceRulePoints = '25,18,15,12,10,8,6,4,2,1';
  raceRuleSaving = false;
  raceRuleError = '';
  raceRuleMessage = '';
  racePenaltyEditorKey: string | null = null;
  racePenaltyPoints = 0;
  racePenaltyReason = '';
  racePenaltySaving = false;
  racePenaltyError = '';
  racePenaltyMessage = '';
  raceDecisionEditorKey: string | null = null;
  raceDecisionTimeSeconds = 0;
  raceDecisionDisqualified = false;
  raceDecisionReason = '';
  raceDecisionSaving = false;
  raceDecisionError = '';
  raceDecisionMessage = '';
  racketRuleEditorKey: string | null = null;
  racketRuleWinPoints = 2;
  racketRuleLossPoints = 0;
  racketRuleTieBreak: 'SETS_FIRST' | 'SCORE_FIRST' = 'SETS_FIRST';
  racketRuleSaving = false;
  racketRuleError = '';
  racketRuleMessage = '';
  maxStandingPoints = 0;
  topGoalsStanding?: CommunityStanding;
  topAssistsStanding?: CommunityStanding;
  topMvpsStanding?: CommunityStanding;
  topCleanSheetsStanding?: CommunityStanding;
  mostGamesStanding?: CommunityStanding;
  bestWinRateStanding?: CommunityStanding;
  bestWinStreakStanding?: CommunityStanding;
  standingsByUsername = new Map<string, CommunityStanding>();
  activeCommunitySeason?: CommunitySeason;
  communityTrophies: CommunitySeason[] = [];
  communitySessions: SessionSummary[] = [];
  isDetailMode = false;

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
  timelineEntries: CommunityTimelineEntry[] = [];
  timelineLoading = false;
  timelineSending = false;
  timelineDeletingId: number | null = null;
  timelineError = '';
  feedDraft = '';
  chatDraft = '';
  replyingToCommunityMessage: CommunityTimelineEntry | null = null;
  chatRealtimeConnected = false;
  chatEverConnected = false;
  chatDeliveryUncertain = false;
  chatDeliveryChecking = false;
  chatOlderLoading = false;
  chatHasOlder = false;
  chatOlderError = '';
  private chatScrollRestore?: { top: number; height: number };
  private pendingChatDelivery?: { communityId: number; text: string; replyToMessageId: number | null; ids: Set<number>; at: number };
  private chatScrollRequested = false;
  private timelineRequestVersion = 0;
  private chatEventsDuringLoad = new Map<number, CommunityTimelineEntry>();

  private currentChatUsername(): string | null {
    try {
      const token = localStorage.getItem('t');
      return token ? this.jwtHelper.decodeToken(token)?.sub ?? null : null;
    } catch { return null; }
  }

  chatDayLabelAt(index: number): string {
    const current = this.timelineEntries[index];
    return current ? chatDaySeparator(current.createdAt,
      index > 0 ? this.timelineEntries[index - 1].createdAt : null) : '';
  }

  chatContinuesGroupAt(index: number): boolean {
    if (index <= 0) return false;
    const current = this.timelineEntries[index], previous = this.timelineEntries[index - 1];
    return current.kind === 'CHAT' && previous.kind === 'CHAT'
      && chatContinuesGroup(current.username, current.createdAt,
        previous.username, previous.createdAt);
  }

  isMyChatEntry(entry: CommunityTimelineEntry): boolean {
    const username = this.currentChatUsername();
    return Boolean(username && username.toLowerCase() === entry.username.toLowerCase());
  }

  private nearChatBottom(): boolean {
    const el = this.communityChatLog?.nativeElement;
    return !el || el.scrollHeight - el.scrollTop - el.clientHeight <= 120;
  }

  ngAfterViewChecked(): void {
    if (this.chatScrollRestore && this.communityChatLog?.nativeElement) {
      const el = this.communityChatLog.nativeElement;
      el.scrollTop = this.chatScrollRestore.top + el.scrollHeight - this.chatScrollRestore.height;
      this.chatScrollRestore = undefined;
      return;
    }
    if (this.chatScrollRequested && this.activeTab === 'chat' && this.communityChatLog?.nativeElement) {
      this.communityChatLog.nativeElement.scrollTop = this.communityChatLog.nativeElement.scrollHeight;
      this.chatScrollRequested = false;
    }
    this.markVisibleCommunityChatRead();
  }

  @HostListener('window:scroll')
  @HostListener('window:focus')
  @HostListener('document:visibilitychange')
  onCommunityChatScroll(): void {
    this.markVisibleCommunityChatRead();
  }

  private markVisibleCommunityChatRead(): void {
    // Never mark a community feed post as a chat message. Only the opened
    // community chat tab with an authorized, successfully loaded log counts.
    if (!this.selected || this.activeTab !== 'chat' || this.timelineLoading || this.timelineError
        || this.timelineEntries.length === 0) return;
    const highestId = this.timelineEntries.reduce((max, entry) =>
      entry.kind === 'CHAT' ? Math.max(max, entry.id) : max, 0);
    this.readSync.markVisible('community', this.selected.id,
      highestId, this.communityChatLog?.nativeElement);
  }

  ngOnDestroy(): void {
    this.typing.destroy();
    this.chatSubscriptions.unsubscribe();
  }

  private sortChatEntries(entries: CommunityTimelineEntry[]): CommunityTimelineEntry[] {
    return [...entries].sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt) || a.id - b.id);
  }

  loadOlderCommunityMessages(): void {
    if (!this.selected || this.activeTab !== 'chat' || this.chatOlderLoading
        || !this.chatHasOlder || !this.timelineEntries.length) return;
    const communityId = this.selected.id;
    const oldestId = this.timelineEntries[0].id;
    const el = this.communityChatLog?.nativeElement;
    const before = el ? { top: el.scrollTop, height: el.scrollHeight } : undefined;
    this.chatOlderLoading = true;
    this.chatOlderError = '';
    this.timelineService.olderMessages(communityId, oldestId)
      .pipe(timeout(10_000), finalize(() => { this.chatOlderLoading = false; }))
      .subscribe({
        next: entries => {
          if (this.selected?.id !== communityId || this.activeTab !== 'chat') return;
          const byId = new Map(this.timelineEntries.map(entry => [entry.id, entry]));
          for (const entry of entries) byId.set(entry.id, entry);
          this.timelineEntries = this.sortChatEntries([...byId.values()]);
          this.chatHasOlder = entries.length === 60;
          if (before) this.chatScrollRestore = before;
        },
        error: () => {
          if (this.selected?.id === communityId) this.chatOlderError = t('chat.olderError');
        }
      });
  }

  private mergeChatEntries(entries: CommunityTimelineEntry[], follow = false): void {
    const byId = new Map(this.timelineEntries.map(item => [item.id, item]));
    for (const entry of entries) byId.set(entry.id, entry);
    this.timelineEntries = this.sortChatEntries([...byId.values()]);
    if (follow) this.chatScrollRequested = true;
    if (this.chatDeliveryUncertain && this.timelineEntries.some(item => this.matchesPendingChatDelivery(item))) {
      this.confirmChatDelivery();
    }
  }

  onCommunityChatRealtime(entry: CommunityTimelineEntry): void {
    if (!this.selected || this.activeTab !== 'chat' || entry.kind !== 'CHAT'
        || entry.communityId !== this.selected.id) return;
    const follow = this.nearChatBottom() || this.isMyChatEntry(entry);
    if (this.timelineLoading) this.chatEventsDuringLoad?.set(entry.id, entry);
    this.mergeChatEntries([entry], follow);
  }

  replyToCommunityMessage(entry: CommunityTimelineEntry): void {
    if (this.activeTab !== 'chat' || !this.selected || entry.kind !== 'CHAT'
        || entry.communityId !== this.selected.id || this.timelineSending || this.chatDeliveryUncertain) return;
    this.replyingToCommunityMessage = entry;
    this.communityComposer?.nativeElement.focus({ preventScroll: true });
  }

  cancelCommunityReply(): void {
    if (!this.timelineSending && !this.chatDeliveryUncertain) this.replyingToCommunityMessage = null;
  }

  private matchesPendingChatDelivery(entry: CommunityTimelineEntry): boolean {
    const pending = this.pendingChatDelivery;
    if (!pending || entry.kind !== 'CHAT' || entry.communityId !== pending.communityId
        || pending.ids.has(entry.id) || !this.isMyChatEntry(entry) || entry.body !== pending.text) return false;
    const date = Date.parse(entry.createdAt);
    return Number.isFinite(date) && date >= pending.at - 60_000
      && (entry.replyToMessageId ?? null) === pending.replyToMessageId;
  }

  private confirmChatDelivery(): void {
    this.chatDeliveryUncertain = false;
    this.pendingChatDelivery = undefined;
    this.typing?.stop();
    this.chatDraft = '';
    this.replyingToCommunityMessage = null;
    this.timelineError = '';
    this.chatScrollRequested = true;
  }

  verifyCommunityChatDelivery(): void {
    if (!this.chatDeliveryUncertain || this.chatDeliveryChecking || !this.pendingChatDelivery) return;
    const id = this.pendingChatDelivery.communityId;
    if (this.selected?.id !== id || this.activeTab !== 'chat') return;
    if (this.timelineEntries.some(item => this.matchesPendingChatDelivery(item))) {
      this.confirmChatDelivery();
      return;
    }
    this.chatDeliveryChecking = true;
    this.timelineService.list(id, 'CHAT')
      .pipe(timeout(10_000), finalize(() => { this.chatDeliveryChecking = false; }))
      .subscribe({
        next: items => {
          if (this.selected?.id !== id || this.activeTab !== 'chat') return;
          this.mergeChatEntries(items, this.nearChatBottom());
          if (this.chatDeliveryUncertain) this.timelineError = t('chat.sendUnconfirmed');
        },
        error: () => { if (this.selected?.id === id) this.timelineError = t('chat.verifyUnavailable'); }
      });
  }

  resumeCommunityChatAfterUncertainSend(): void {
    if (this.chatDeliveryChecking) return;
    this.pendingChatDelivery = undefined;
    this.chatDeliveryUncertain = false;
    this.timelineError = t('chat.sendRetryWarning');
  }

  onTypingInput(): void {
    if (this.selected && this.activeTab === 'chat')
      this.typing.input('community', this.selected.id, this.chatDraft,
        !this.timelineSending && !this.chatDeliveryUncertain);
  }

  onCommunityChatEnter(event: Event): void {
    const keyboard = event as KeyboardEvent;
    if (keyboard.shiftKey || keyboard.isComposing || keyboard.keyCode === 229) return;
    keyboard.preventDefault();
    this.sendTimeline();
  }

  private isUncertainChatError(error: unknown): boolean {
    return error instanceof TimeoutError
      || error instanceof HttpErrorResponse
      && (error.status === 0 || error.status === 408 || error.status === 429 || error.status >= 500);
  }

  get timelineKind(): CommunityTimelineKind {
    return this.activeTab === 'chat' ? 'CHAT' : 'POST';
  }

  loadTimeline(): void {
    if (!this.selected || (this.activeTab !== 'feed' && this.activeTab !== 'chat')) return;
    const communityId = this.selected.id;
    const kind = this.timelineKind;
    const version = ++this.timelineRequestVersion;
    this.timelineLoading = true;
    if (kind === 'CHAT') this.chatEventsDuringLoad?.clear();
    this.timelineError = '';
    this.timelineService.list(communityId, kind)
      .pipe(timeout(10_000), finalize(() => {
        if (version === this.timelineRequestVersion) this.timelineLoading = false;
      }))
      .subscribe({
        next: entries => {
          if (version === this.timelineRequestVersion && this.selected?.id === communityId
              && this.timelineKind === kind) {
            if (kind === 'CHAT') {
              // HTTP history is authoritative, including moderators' deletions.
              // Preserve only websocket messages received while the HTTP request ran.
              const follow = this.timelineEntries.length === 0 || this.nearChatBottom();
              const byId = new Map(entries.map(entry => [entry.id, entry]));
              for (const entry of this.chatEventsDuringLoad?.values() ?? []) byId.set(entry.id, entry);
              this.timelineEntries = this.sortChatEntries([...byId.values()]);
              this.chatHasOlder = this.chatHasOlder || entries.length === 60;
              this.chatEventsDuringLoad?.clear();
              if (follow) this.chatScrollRequested = true;
              if (this.chatDeliveryUncertain
                  && this.timelineEntries.some(entry => this.matchesPendingChatDelivery(entry))) {
                this.confirmChatDelivery();
              }
            } else this.timelineEntries = entries;
          }
        },
        error: () => {
          if (version === this.timelineRequestVersion) this.timelineError = t('communities.timelineLoadError');
        }
      });
  }

  sendTimeline(): void {
    if (this.activeTab === 'chat') this.typing?.stop();
    if (!this.selected || this.timelineSending ||
        (this.activeTab !== 'feed' && this.activeTab !== 'chat') ||
        (this.activeTab === 'chat' && this.chatDeliveryUncertain)) return;
    const kind = this.timelineKind;
    const communityId = this.selected.id;
    const text = kind === 'CHAT' ? this.chatDraft.trim() : this.feedDraft.trim();
    const max = kind === 'CHAT' ? 2000 : 1000;
    if (!text || text.length > max) return;
    this.timelineSending = true;
    this.timelineError = '';
    const replyId = kind === 'CHAT' ? this.replyingToCommunityMessage?.id ?? null : null;
    if (kind === 'CHAT') this.communityComposer?.nativeElement.focus({ preventScroll: true });
    const pending = kind === 'CHAT'
      ? { communityId, text, replyToMessageId: replyId,
          ids: new Set(this.timelineEntries.map(entry => entry.id)), at: Date.now() }
      : undefined;
    const send = replyId
      ? this.timelineService.send(communityId, kind, text, replyId)
      : this.timelineService.send(communityId, kind, text);
    send
      .pipe(timeout(10_000), finalize(() => this.timelineSending = false))
      .subscribe({
        next: entry => {
          if (this.selected?.id !== communityId) return;
          if (kind === 'CHAT') {
            if (this.activeTab === 'chat') {
              this.mergeChatEntries([entry], true);
              // The authoritative recent history also reflects moderation and
              // messages sent between the HTTP POST and its acknowledgement.
              this.loadTimeline();
            }
            this.chatDraft = '';
            this.replyingToCommunityMessage = null;
            this.pendingChatDelivery = undefined;
            this.chatDeliveryUncertain = false;
          } else {
            this.feedDraft = '';
            if (this.timelineKind === kind) this.loadTimeline();
          }
        },
        error: error => {
          if (this.selected?.id !== communityId) return;
          if (kind === 'CHAT' && pending && this.isUncertainChatError(error)) {
            this.pendingChatDelivery = pending;
            this.chatDeliveryUncertain = true;
            this.timelineError = t('chat.sendUncertain');
            this.verifyCommunityChatDelivery();
          } else this.timelineError = t('communities.timelineSendError');
        }
      });
  }

  deleteTimeline(entry: CommunityTimelineEntry): void {
    if (!this.selected || !this.canManage() || this.timelineDeletingId !== null ||
        entry.communityId !== this.selected.id || entry.kind !== this.timelineKind) return;
    const communityId = this.selected.id;
    const kind = this.timelineKind;
    this.timelineDeletingId = entry.id;
    this.timelineError = '';
    this.timelineService.delete(communityId, kind, entry.id)
      .pipe(timeout(10_000), finalize(() => this.timelineDeletingId = null))
      .subscribe({
        next: () => {
          if (this.selected?.id === communityId && this.timelineKind === kind) this.loadTimeline();
        },
        error: () => {
          if (this.selected?.id === communityId) this.timelineError = t('communities.timelineDeleteError');
        }
      });
  }

  showAllStandings = false;
  historicalPlayers: HistoricalPlayerCandidate[] = [];
  historicalPlayersLoading = false;
  historicalPlayersError = '';
  historicalPlayerId: number | null = null;
  historicalClaimAcknowledged = false;
  historicalClaimSaving = false;
  historicalClaimMessage = '';
  historicalClaims: HistoricalPlayerLink[] = [];
  historicalClaimsLoading = false;
  historicalClaimsError = '';
  historicalReleaseId: number | null = null;

  get rankingParticipants(): CommunityStanding[] {
    return (this.competition?.standings || []).filter(row => row.games > 0);
  }

  get displayedRankings(): CommunityStanding[] {
    return this.showAllStandings ? (this.competition?.standings || []) : this.rankingParticipants;
  }

  // Imported rounds retain the source name; handle exists only for a verified profile.
  roundEntryHandle(entry: Pick<CommunityRoundEntry, 'username'>): string {
    return entry.username ? '@' + entry.username : t('communities.identity.unlinked');
  }

  roundSport(round: CommunityRound): string | null {
    return sportForRound(round, this.selected);
  }

  roundView(round: CommunityRound): CommunityRoundView {
    return eventView(this.roundSport(round), round.eventType);
  }

  eventOptions(sport: string | null) {
    return eventOptionsForSport(sport);
  }

  eventTypeLabel(type: string): string {
    return t('communities.eventType.' + type.toLowerCase());
  }

  athleticsDisciplineOptions = athleticsDisciplineOptions;
  fieldDisciplineLabel(code: string): string {
    return t('communities.discipline.' + code.toLowerCase());
  }
  performanceKind = performanceKind;
  performanceDisplay = performanceDisplay;
  surfWaveTotal = surfWaveTotal;
  isWaveHeatEvent = isWaveHeatEvent;

  waveLabelKey(eventType: string | null | undefined, position: 1 | 2): string {
    return (eventType === 'BODYBOARD_HEAT' ? 'communities.bodyboard.' : 'communities.surf.')
      + 'wave' + position;
  }

  eventPerformanceEntries(round: CommunityRound): CommunityRoundEntry[] {
    return eventPerformanceEntries(round);
  }

  eventPerformancePlace(entries: CommunityRoundEntry[], entry: CommunityRoundEntry, type?: string | null): number | null {
    return eventPerformancePlace(entries, entry, type);
  }

  neutralRound(round: CommunityRound): boolean {
    return isNeutralEvent(this.roundSport(round), round.eventType);
  }

  raceSupportsLaps(sport: string | null): boolean {
    return raceSupportsLaps(sport);
  }

  raceTime(seconds: number | null | undefined): string | null {
    return formatRaceSeconds(seconds);
  }

  roundFormatLabel(round: CommunityRound): string {
    return t('communities.resultFormat.' +
      eventPresentationFormat(this.roundSport(round), round.eventType));
  }

  get communityRoundSports(): string[] {
    return this.selected ? this.communitySports(this.selected) : [];
  }

  get newRoundSport(): string | null {
    return this.communityRoundSports.length === 1
      ? this.communityRoundSports[0] : (this.roundSportDraft || null);
  }

  get newImportSport(): string | null {
    return this.communityRoundSports.length === 1
      ? this.communityRoundSports[0] : (this.importSportDraft || null);
  }

  get newRoundEventType(): CommunityEventType | null {
    return this.roundEventTypeDraft ? this.roundEventTypeDraft as CommunityEventType : null;
  }

  viewForNewRound(): CommunityRoundView {
    // While event selection is missing, do not show race or football stats.
    if (eventOptionsForSport(this.newRoundSport).length && !this.newRoundEventType)
      return 'unknown';
    return eventView(this.newRoundSport, this.newRoundEventType);
  }

  canManageRaceChampionship(): boolean {
    return this.canManage() && this.selectedSeasonId != null
      && this.selectedSeasonId === this.competition?.activeSeasonId;
  }

  editRaceRule(group: CommunityRaceStandingGroup): void {
    if (!this.canManageRaceChampionship() || this.raceRuleSaving) return;
    this.raceRuleSport = group.sport;
    this.raceRulePoints = group.rule?.pointsByPlace.join(',') ?? '25,18,15,12,10,8,6,4,2,1';
    this.raceRuleError = '';
    this.raceRuleMessage = '';
  }

  cancelRaceRule(): void {
    if (!this.raceRuleSaving) this.raceRuleSport = null;
    this.raceRuleError = '';
  }

  saveRaceRule(group: CommunityRaceStandingGroup): void {
    if (!this.selected || !this.canManageRaceChampionship() || this.raceRuleSaving
        || this.raceRuleSport !== group.sport) return;
    const scores = this.raceRulePoints.split(',').map(s => s.trim());
    const integers = scores.map(s => Number(s));
    if (!scores.length || scores.length > 20 ||
        scores.some(s => !/^\d{1,4}$/.test(s)) ||
        integers.some((v, i) => v > 1000 || (i > 0 && v > integers[i - 1]))) {
      this.raceRuleError = t('feedback.communities.raceRuleInvalid');
      return;
    }
    const communityId = this.selected.id, seasonId = this.selectedSeasonId!;
    this.raceRuleSaving = true;
    this.raceRuleError = '';
    this.communityService.updateRaceRule(communityId, seasonId, {
      sport: group.sport, pointsByPlace: integers.join(',')
    }).pipe(timeout(10_000), finalize(() => this.raceRuleSaving = false)).subscribe({
      next: () => {
        if (this.selected?.id !== communityId || this.selectedSeasonId !== seasonId) return;
        this.raceRuleSport = null;
        this.raceRuleMessage = t('communities.race.ruleSaved');
        this.loadCompetition(this.selected, seasonId);
      },
      error: () => { this.raceRuleError = t('feedback.communities.raceRuleError'); }
    });
  }

  editRacePenalty(round: CommunityRound, entry: CommunityRoundEntry): void {
    if (!this.canManageRaceChampionship() || this.racePenaltySaving
      || entry.entryId == null || entry.finishPosition == null) return;
    this.racePenaltyEditorKey = round.id + ':' + entry.entryId;
    this.racePenaltyPoints = entry.racePenaltyPoints ?? 0;
    this.racePenaltyReason = entry.racePenaltyReason ?? '';
    this.racePenaltyError = '';
    this.racePenaltyMessage = '';
  }

  cancelRacePenalty(): void {
    if (!this.racePenaltySaving) this.racePenaltyEditorKey = null;
    this.racePenaltyError = '';
  }

  saveRacePenalty(round: CommunityRound, entry: CommunityRoundEntry): void {
    if (!this.selected || !this.canManageRaceChampionship() || this.racePenaltySaving ||
       entry.entryId == null || this.racePenaltyEditorKey !== round.id + ':' + entry.entryId) return;
    const points = Number(this.racePenaltyPoints);
    if (!Number.isInteger(points) || points < 0 || points > 1000 ||
        (points > 0 && !this.racePenaltyReason.trim()) || this.racePenaltyReason.length > 255) {
      this.racePenaltyError = t('feedback.communities.racePenaltyInvalid');
      return;
    }
    const communityId = this.selected.id, seasonId = this.selectedSeasonId!;
    this.racePenaltySaving = true;
    this.communityService.updateRacePenalty(communityId, round.id, entry.entryId, {
      penaltyPoints: points, reason: points ? this.racePenaltyReason.trim() : null
    }).pipe(timeout(10_000), finalize(() => this.racePenaltySaving = false)).subscribe({
      next: () => {
        if (this.selected?.id !== communityId || this.selectedSeasonId !== seasonId) return;
        this.racePenaltyEditorKey = null;
        this.racePenaltyMessage = t('communities.race.penaltySaved');
        this.loadCompetition(this.selected, seasonId);
      },
      error: () => { this.racePenaltyError = t('feedback.communities.racePenaltyError'); }
    });
  }

  editRaceDecision(round: CommunityRound, entry: CommunityRoundEntry): void {
    if (!this.canManageRaceChampionship() || this.raceDecisionSaving
        || entry.entryId == null || entry.finishPosition == null) return;
    this.raceDecisionEditorKey = round.id + ':' + entry.entryId;
    this.raceDecisionTimeSeconds = entry.raceTimePenaltySeconds ?? 0;
    this.raceDecisionDisqualified = entry.raceDisqualified ?? false;
    this.raceDecisionReason = entry.raceStewardReason ?? '';
    this.raceDecisionError = '';
    this.raceDecisionMessage = '';
  }

  cancelRaceDecision(): void {
    if (!this.raceDecisionSaving) this.raceDecisionEditorKey = null;
    this.raceDecisionError = '';
  }

  saveRaceDecision(round: CommunityRound, entry: CommunityRoundEntry): void {
    if (!this.selected || !this.canManageRaceChampionship() || this.raceDecisionSaving
        || entry.entryId == null
        || this.raceDecisionEditorKey !== round.id + ':' + entry.entryId) return;
    const seconds = Number(this.raceDecisionTimeSeconds);
    const reason = this.raceDecisionReason.trim();
    if (raceDecisionError(seconds, this.raceDecisionDisqualified,
        this.raceDecisionReason, entry.elapsedSeconds)) {
      this.raceDecisionError = t('feedback.communities.raceDecisionInvalid');
      return;
    }
    const communityId = this.selected.id, seasonId = this.selectedSeasonId!;
    this.raceDecisionSaving = true;
    this.raceDecisionError = '';
    this.communityService.updateRaceDecision(communityId, round.id, entry.entryId, {
      timePenaltySeconds: seconds,
      disqualified: this.raceDecisionDisqualified,
      reason: seconds > 0 || this.raceDecisionDisqualified ? reason : null
    }).pipe(timeout(10_000), finalize(() => this.raceDecisionSaving = false)).subscribe({
      next: () => {
        if (this.selected?.id !== communityId || this.selectedSeasonId !== seasonId) return;
        this.raceDecisionEditorKey = null;
        this.raceDecisionMessage = t('communities.race.decisionSaved');
        this.loadCompetition(this.selected, seasonId);
      },
      error: () => { this.raceDecisionError = t('feedback.communities.raceDecisionError'); }
    });
  }

  racketRuleKey(group: CommunityRacketStandingGroup): string {
    return group.sport.toLocaleLowerCase() + ':' + group.matchFormat;
  }

  canConfigureRacketRules(): boolean {
    return this.canManage() && this.selectedSeasonId !== null &&
      this.selectedSeasonId === this.competition?.activeSeasonId;
  }

  editRacketRule(group: CommunityRacketStandingGroup): void {
    if (!this.canConfigureRacketRules() || this.racketRuleSaving) return;
    this.racketRuleEditorKey = this.racketRuleKey(group);
    this.racketRuleWinPoints = group.rule?.winPoints ?? 2;
    this.racketRuleLossPoints = group.rule?.lossPoints ?? 0;
    this.racketRuleTieBreak = group.rule?.tieBreak ?? 'SETS_FIRST';
    this.racketRuleMessage = '';
    this.racketRuleError = '';
  }

  cancelRacketRule(): void {
    if (this.racketRuleSaving) return;
    this.racketRuleEditorKey = null;
    this.racketRuleError = '';
  }

  saveRacketRule(group: CommunityRacketStandingGroup): void {
    if (!this.selected || !this.canConfigureRacketRules() || this.racketRuleSaving
        || this.racketRuleEditorKey !== this.racketRuleKey(group)) return;
    const win = Number(this.racketRuleWinPoints);
    const loss = Number(this.racketRuleLossPoints);
    if (!Number.isInteger(win) || !Number.isInteger(loss)
        || win > 100 || loss < 0 || win <= loss) {
      this.racketRuleError = t('feedback.communities.racketRuleInvalid');
      return;
    }
    const communityId = this.selected.id;
    const seasonId = this.selectedSeasonId!;
    const editKey = this.racketRuleEditorKey;
    this.racketRuleSaving = true;
    this.racketRuleError = '';
    this.communityService.updateRacketRule(communityId, seasonId, {
      sport: group.sport,
      matchFormat: group.matchFormat,
      winPoints: win,
      lossPoints: loss,
      tieBreak: this.racketRuleTieBreak
    }).pipe(
      timeout(10_000),
      finalize(() => this.racketRuleSaving = false)
    ).subscribe({
      next: () => {
        if (this.selected?.id !== communityId || this.selectedSeasonId !== seasonId) return;
        this.racketRuleEditorKey = null;
        this.racketRuleMessage = t('communities.racket.ruleSaved');
        this.loadCompetition(this.selected, seasonId);
      },
      error: () => {
        if (this.selected?.id !== communityId || this.selectedSeasonId !== seasonId
            || this.racketRuleEditorKey !== editKey) return;
        this.racketRuleError = t('feedback.communities.racketRuleError');
      }
    });
  }

  racketSupportsSets(sport: string | null): boolean {
    return racketSupportsSets(sport);
  }

  racketUsesPointsPerSet(sport: string | null): boolean {
    return racketUsesPointsPerSet(sport);
  }

  recordedRacketMatch(round: CommunityRound): boolean {
    return recordedRacketMatch(round);
  }

  racketSidePlayers(round: CommunityRound, side: 'A' | 'B'): CommunityRoundEntry[] {
    return round.entries.filter(e => e.team === side);
  }

  addRacketSet(): void {
    if (this.racketSetScores.length < 5) {
      this.racketSetScores.push({ sideA: null, sideB: null });
    }
  }

  removeRacketSet(index: number): void {
    if (this.racketSetScores.length > 1) this.racketSetScores.splice(index, 1);
  }

  roundMatchup(round: CommunityRound): CommunityRoundMatchup | null {
    const mode = this.roundView(round);
    if (mode === 'race' || recordedRacketMatch(round)) return null;
    const matchup = communityRoundMatchup(
      round, t('communities.matchup.teamA'), t('communities.matchup.teamB')
    );
    // For individual and unknown modalities accept only explicit team labels.
    return mode === 'team' || (matchup && !matchup.inferred) ? matchup : null;
  }

  get availableHistoricalPlayers(): HistoricalPlayerCandidate[] {
    return this.historicalPlayers.filter(candidate => candidate.linkStatus === 'UNLINKED');
  }
  inviteUsername = '';
  inviteSearchResults: CommunityProfile[] = [];
  inviteSearchLoading = false;
  inviteSearchPerformed = false;
  inviteMessage = '';
  groupInviteFeedback = '';
  pendingJoinRequests: CommunityJoinRequest[] = [];
  pendingJoinRequestsLoading = false;
  joinRequestActionId?: number;
  selectedJoinRequestIds = new Set<number>();
  confirmingBatchJoin = false;
  batchJoining = false;
  batchJoinProcessed = 0;
  batchJoinTotal = 0;
  batchJoinFeedback = '';
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
  private communitySearchRequestVersion = 0;
  private reloadRequestVersion = 0;
  communityPresentation?: CommunitySearchPresentation;
  presentationLoading = false;
  membershipActionLoading = false;
  membershipActionMessage = '';
  joinRequestSent = false;
  pendingJoinLookupLoading = false;
  private pendingJoinLookupVersion = 0;
  private pendingRequestsLookupVersion = 0;
  private communityOpenRequestVersion = 0;
  private competitionRequestVersion = 0;
  private communitySessionsRequestVersion = 0;
  private matchArchiveListRequestVersion = 0;
  private matchArchiveDetailRequestVersion = 0;
  private standingArchiveListRequestVersion = 0;
  private standingArchiveDetailRequestVersion = 0;
  private pendingArchiveDeepLinkCommunityId: number | null = null;

  featuresEditing = false;
  featuresSaving = false;
  featuresFeedback = '';
  featuresError = '';
  featuresDraft = {
    rankingsEnabled: false,
    individualTournamentsEnabled: false,
    teamTournamentsEnabled: false
  };

  hasCompetitions(group: CommunityGroup | undefined): boolean {
    return !!group && (group.individualTournamentsEnabled !== false
      || group.teamTournamentsEnabled !== false);
  }

  // Saved archives remain useful when a community turns off live standings.
  get canBrowseHistoricalArchives(): boolean {
    return !!this.selected && (this.selected.rankingsEnabled
      || this.hasCompetitions(this.selected)
      || (this.archiveSummaries?.length ?? 0) > 0
      || (this.matchArchiveSummaries?.length ?? 0) > 0);
  }

  editFeatures(): void {
    if (!this.canManage() || !this.selected || this.featuresSaving) return;
    this.featuresDraft = {
      rankingsEnabled: this.selected.rankingsEnabled,
      individualTournamentsEnabled: this.selected.individualTournamentsEnabled !== false,
      teamTournamentsEnabled: this.selected.teamTournamentsEnabled !== false
    };
    this.featuresError = '';
    this.featuresFeedback = '';
    this.featuresEditing = true;
  }

  cancelFeaturesEdit(): void {
    if (!this.featuresSaving) this.featuresEditing = false;
  }

  saveFeatures(): void {
    if (!this.canManage() || !this.selected || !this.featuresEditing || this.featuresSaving) return;
    const communityId = this.selected.id;
    const request = { ...this.featuresDraft };
    this.featuresSaving = true;
    this.featuresError = '';
    this.featuresFeedback = '';
    this.communityService.updateFeatures(communityId, request)
      .pipe(timeout(10_000), finalize(() => this.featuresSaving = false))
      .subscribe({
        next: updated => {
          if (this.selected?.id !== communityId) return;
          this.selected = updated;
          this.communities = this.communities.map(item => item.id === communityId ? updated : item);
          this.featuresEditing = false;
          this.featuresFeedback = 'Funcionalidades atualizadas. O histórico foi preservado.';
          this.activeTab = 'home';
          this.loadCompetition(updated);
        },
        error: () => { if (this.selected?.id === communityId)
          this.featuresError = 'Não foi possível atualizar as funcionalidades. Tenta novamente.'; }
      });
  }

  rankingsEnabledDraft = false;
  winPointsDraft = 3;
  drawPointsDraft = 1;
  lossPointsDraft = 0;

  roundName = '';
  roundPlayedAt = '';
  roundSportDraft = '';
  roundEventTypeDraft = '';
  roundDisciplineDraft = '';
  importSportDraft = '';
  racketMatchFormat: 'SINGLES' | 'DOUBLES' = 'SINGLES';
  racketSetScores: Array<{ sideA: number | null; sideB: number | null }> =
    [{ sideA: null, sideB: null }, { sideA: null, sideB: null }];
  roundEntries: CommunityRoundEntryDraft[] = [];
  roundDeleteConfirmId?: number;

  selectedSeasonId: number | null = null;
  seasonName = '';
  seasonStartsAt = '';
  seasonSaving = false;
  closeSeasonConfirming = false;
  editingSeasonId: number | null = null;
  editingSeasonName = '';
  deletingSeasonId: number | null = null;
  seasonDeleteAcknowledged = false;
  seasonActionSaving = false;
  seasonActionError = '';
  seasonActionMessage = '';

  importMode: 'ROUNDS' | 'STANDINGS' | 'MATCHES' = 'ROUNDS';
  matchPreviewLoading = false;
  matchPreview?: HistoricalMatchPreview;
  matchArchiveTitle = '';
  matchArchiveEntryType: 'INDIVIDUAL' | 'TEAM' = 'INDIVIDUAL';
  matchArchiveAcknowledged = false;
  matchArchiveConfirming = false;
  matchArchiveConfirmed?: HistoricalMatchArchive;
  matchArchivesLoading = false;
  matchArchivesError = '';
  matchArchiveSummaries: HistoricalMatchArchiveSummary[] = [];
  matchArchiveOpen?: HistoricalMatchArchive;
  matchArchiveOpeningId?: number;
  matchArchivePage = 0;
  archiveTitle = '';
  archiveEntryType: 'INDIVIDUAL' | 'TEAM' = 'INDIVIDUAL';
  archiveSeasonId: number | null = null;
  archiveAcknowledged = false;
  archivePreviewLoading = false;
  archivePreview?: HistoricalStandingPreview;
  archiveConfirmed?: HistoricalStandingArchive;
  archivesLoading = false;
  archivesError = '';
  archiveSummaries: HistoricalStandingSummary[] = [];
  archiveOpen?: HistoricalStandingArchive;
  archiveOpeningId?: number;
  importFile?: File;
  importFileName = '';
  importFileError = '';
  importRevision = 0;
  sourceDatesNeedYear = false;
  importPointsAcknowledged = false;
  importPreviewLoading = false;
  importSheetName = '';
  importMappings: Array<{ columnIndex: number; header: string; field: string; confidence: number }> = [];
  importValidation?: { valid: boolean; dataRows: number; validRows: number; errors: string[]; warnings: string[] };
  importNormalized?: { acceptedRows: number; skippedRows: number; rows: any[]; skipped: any[] };
  importMappingLoading = false;
  importDefaultYear: number | null = new Date().getFullYear();
  importSourceCompetition = '';
  importSourceRound = '';
  importPlanLoading = false;
  importFinalPlan?: any;
  importConfirming = false;
  importResult?: { createdRounds: number; skippedDuplicateRounds: number; createdEntries: number };
  get importFields(): string[] {
    if (this.importMode === 'STANDINGS') {
      return ['IGNORE', 'NAME', 'POSITION', 'POINTS', 'PLAYED', 'WINS', 'DRAWS', 'LOSSES', 'GOALS_FOR', 'GOALS_AGAINST'];
    }
    if (this.importMode === 'MATCHES') {
      return ['IGNORE', 'HOME', 'AWAY', 'SCORE', 'HOME_SCORE', 'AWAY_SCORE', 'DATE', 'ROUND'];
    }
    return ['IGNORE', 'PLAYER', 'DATE', 'RESULT', 'WIN', 'DRAW', 'LOSS', 'GOALS', 'ASSISTS', 'POINTS', 'MVP'];
  }
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
    private timelineService: CommunityTimelineService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  private positiveQueryId(key: string): number | null {
    const raw = this.route.snapshot.queryParamMap.get(key);
    if (!raw || !/^[1-9][0-9]*$/.test(raw)) return null;
    const id = Number(raw);
    return Number.isSafeInteger(id) ? id : null;
  }

  get invitedTournamentId(): number | null {
    return this.positiveQueryId('tournament');
  }

  get invitedTeamId(): number | null {
    return this.invitedTournamentId ? this.positiveQueryId('team') : null;
  }

  ngOnInit(): void {
    this.isDetailMode = Boolean(this.route.snapshot.paramMap.get('id'));
    this.reload();
    this.realtimeService.connect();
    this.chatSubscriptions.add(this.realtimeService.communityMessages$.subscribe(
      entry => this.onCommunityChatRealtime(entry)
    ));
    this.chatSubscriptions.add(this.realtimeService.connected$.subscribe(connected => {
      this.chatRealtimeConnected = connected;
      if (connected) {
        this.chatEverConnected = true;
        // Recover missed events after reconnection, but only for the open chat.
        if (this.selected && this.activeTab === 'chat') this.loadTimeline();
      }
    }));
  }

  detailMode(): boolean {
    return this.isDetailMode;
  }

  /**
   * A member lands on their communities by default; new users see onboarding.
   * Query parameters always take precedence, including the targeted invite
   * deep link sent by email. Do not use routerLinkActive exact here: extra
   * invite query parameters would incorrectly hide the recipient's inbox.
   */
  showMineView(): boolean {
    if (this.detailMode()) return false;
    const view = this.route.snapshot.queryParamMap.get('view');
    if (view === 'mine') return true;
    if (view === 'explore') return false;
    return this.communities.length > 0;
  }

  private requestedInviteId(): number | null {
    const raw = this.route.snapshot.queryParamMap.get('invite');
    const id = raw && /^[1-9]\d*$/.test(raw) ? Number(raw) : NaN;
    return Number.isSafeInteger(id) ? id : null;
  }

  isTargetedInvite(invite: CommunityInvite): boolean {
    return invite.id === this.requestedInviteId();
  }

  backToCommunities(): void {
    void this.router.navigate(['/menu/communities']);
  }

  exploreCommunities(): void {
    this.communitySearchName = '';
    this.communitySearchSport = '';
    this.searchCommunities(0);
    this.communitySearchSection?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  searchCommunities(page = 0): void {
    const name = this.communitySearchName.trim();
    const sport = this.communitySearchSport.trim();
    // A slower, older response must not replace a newer search or its loading state.
    const requestVersion = (this.communitySearchRequestVersion ?? 0) + 1;
    this.communitySearchRequestVersion = requestVersion;

    this.communitySearchLoading = true;
    this.communitySearchError = '';
    this.communityService.search(name, sport, page)
      .pipe(
        timeout(10_000),
        retry({ count: 1 }),
        finalize(() => {
          if (requestVersion === this.communitySearchRequestVersion) {
            this.communitySearchLoading = false;
          }
        })
      )
      .subscribe({
        next: result => {
          if (requestVersion !== this.communitySearchRequestVersion) return;
          this.communitySearchResults = result.communities;
          this.communitySearchPage = result.page;
          this.communitySearchHasMore = result.hasMore;
          this.communitySearchPerformed = true;
        },
        error: () => {
          if (requestVersion !== this.communitySearchRequestVersion) return;
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
    this.searchCommunities(0);
  }

  openCommunityPresentation(community: CommunitySearchPresentation): void {
    void this.router.navigate(['/menu/communities', community.id]);
  }

  private loadCommunityPresentation(id: number): void {
    this.pendingArchiveDeepLinkCommunityId = null;
    this.invalidateArchiveRequests();
    // Only the most recent presentation request may change this view.
    const presentationVersion = (this.communityOpenRequestVersion || 0) + 1;
    this.communityOpenRequestVersion = presentationVersion;
    this.competitionRequestVersion = (this.competitionRequestVersion || 0) + 1;
    this.communitySessionsRequestVersion = (this.communitySessionsRequestVersion || 0) + 1;
    ++this.pendingJoinLookupVersion;
    this.pendingJoinLookupLoading = false;
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
        finalize(() => {
          if (presentationVersion === this.communityOpenRequestVersion) {
            this.presentationLoading = false;
          }
        })
      )
      .subscribe({
        next: presentation => {
          if (presentationVersion !== this.communityOpenRequestVersion) return;
          this.communityPresentation = presentation;
          if (presentation.visibility === 'PRIVATE') {
            this.loadMyPendingJoinRequest(presentation.id);
          }
        },
        error: () => {
          if (presentationVersion === this.communityOpenRequestVersion) {
            this.errorMessage = t('feedback.communities.openError');
          }
        }
      });
  }

  private loadMyPendingJoinRequest(communityId: number): void {
    const lookupVersion = ++this.pendingJoinLookupVersion;
    this.pendingJoinLookupLoading = true;
    this.communityService.myPendingJoinRequest(communityId)
      .pipe(
        timeout(10_000),
        finalize(() => {
          if (lookupVersion === this.pendingJoinLookupVersion) {
            this.pendingJoinLookupLoading = false;
          }
        })
      )
      .subscribe({
        next: request => {
          if (lookupVersion !== this.pendingJoinLookupVersion
              || this.communityPresentation?.id !== communityId) return;
          this.joinRequestSent = Boolean(request);
          this.membershipActionMessage = request
            ? t('communities.joinRequestSent')
            : '';
        },
        error: () => {
          if (lookupVersion !== this.pendingJoinLookupVersion
              || this.communityPresentation?.id !== communityId) return;
          this.joinRequestSent = false;
          this.membershipActionMessage = '';
        }
      });
  }

  joinPresentedCommunity(): void {
    const community = this.communityPresentation;
    if (!community || this.membershipActionLoading || this.joinRequestSent
        || (community.visibility === 'PRIVATE' && this.pendingJoinLookupLoading)) {
      return;
    }

    // Older GET responses must never undo a submitted join request.
    ++this.pendingJoinLookupVersion;
    this.pendingJoinLookupLoading = false;
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
          if (this.communityPresentation?.id !== community.id) return;
          if (community.visibility === 'PUBLIC') {
            this.reload();
            return;
          }

          this.joinRequestSent = true;
          this.membershipActionMessage = t('communities.joinRequestSent');
        },
        error: error => {
          if (this.communityPresentation?.id !== community.id) return;
          this.errorMessage = error.error?.message
            || t('feedback.communities.joinError');
        }
      });
  }

  reload(): void {
    // Only the latest reload can update the groups, invites or loading state.
    const reloadVersion = (this.reloadRequestVersion || 0) + 1;
    this.reloadRequestVersion = reloadVersion;
    this.loading = true;
    this.errorMessage = '';

    this.communityService.mine()
      .pipe(
        timeout(10_000),
        retry({ count: 1 }),
        finalize(() => {
          if (reloadVersion === this.reloadRequestVersion) this.loading = false;
        })
      )
      .subscribe({
        next: communities => {
          if (reloadVersion !== this.reloadRequestVersion) return;
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
        error: () => {
          if (reloadVersion === this.reloadRequestVersion) {
            this.errorMessage = t('feedback.communities.loadError');
          }
        }
      });

    this.communityService.myInvites()
      .pipe(
        timeout(10_000),
        retry({ count: 1 })
      )
      .subscribe({
        next: invites => {
          if (reloadVersion !== this.reloadRequestVersion) return;
          const targetInviteId = this.requestedInviteId();
          this.invites = [...invites].sort((first, second) =>
            Number(second.id === targetInviteId) - Number(first.id === targetInviteId));

        },
        error: () => {
          if (reloadVersion === this.reloadRequestVersion) this.invites = [];
        }
      });
  }

  get availableSportSuggestions(): string[] {
    const query = this.sportsSearch.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    if (!query) return [];
    return SPORTS_CATALOG.filter(value =>
      value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(query)
      && !(this.sportsDraft || []).some(current => current.toLowerCase() === value.toLowerCase())
    ).slice(0, 8);
  }

  communitySports(group: Pick<CommunityGroup, 'sport' | 'sports'>): string[] {
    return group.sports?.length ? group.sports : (group.sport ? [group.sport] : []);
  }

  editSports(): void {
    if (!this.selected || !this.canManage() || this.savingSports) return;
    this.sportsDraft = [...this.communitySports(this.selected)];
    this.sportsSearch = '';
    this.sportsMessage = '';
    this.editingSports = true;
  }

  cancelSportsEdit(): void {
    if (this.savingSports) return;
    this.editingSports = false;
    this.sportsSearch = '';
  }

  addCommunitySport(value: string): void {
    if (!this.editingSports || this.savingSports || this.sportsDraft.length >= 128
        || !SPORTS_CATALOG.includes(value)
        || this.sportsDraft.some(sport => sport.toLowerCase() === value.toLowerCase())) return;
    this.sportsDraft = [...this.sportsDraft, value];
    this.sportsSearch = '';
  }

  removeCommunitySport(value: string): void {
    if (this.savingSports) return;
    this.sportsDraft = this.sportsDraft.filter(sport => sport !== value);
  }

  saveCommunitySports(): void {
    if (!this.selected || !this.canManage() || !this.editingSports || this.savingSports) return;
    const id = this.selected.id;
    this.savingSports = true;
    this.errorMessage = '';
    this.sportsMessage = '';
    this.communityService.updateSports(id, [...this.sportsDraft])
      .pipe(timeout(10_000), finalize(() => this.savingSports = false))
      .subscribe({
        next: group => {
          if (this.selected?.id !== id) return;
          this.selected = group;
          this.replaceCommunity(group);
          this.editingSports = false;
          this.sportsMessage = 'Modalidades atualizadas.';
        },
        error: () => {
          if (this.selected?.id === id) this.errorMessage = 'Não foi possível atualizar as modalidades.';
        }
      });
  }

  open(community: CommunityGroup): void {
    if (!this.detailMode()) {
      void this.router.navigate(['/menu/communities', community.id]);
      return;
    }

    this.pendingArchiveDeepLinkCommunityId = null;
    this.invalidateArchiveRequests();
    // A slower response from an earlier navigation must never replace the latest group.
    const openVersion = (this.communityOpenRequestVersion || 0) + 1;
    this.communityOpenRequestVersion = openVersion;
    this.competitionRequestVersion = (this.competitionRequestVersion || 0) + 1;
    this.communitySessionsRequestVersion = (this.communitySessionsRequestVersion || 0) + 1;
    ++this.pendingRequestsLookupVersion;
    this.presentationLoading = false;
    this.editingSports = false;
    this.sportsMessage = '';
    this.featuresEditing = false;
    this.featuresFeedback = '';
    this.featuresError = '';
    this.pendingJoinRequestsLoading = false;
    this.pendingJoinRequests = [];
    ++this.timelineRequestVersion;
    this.chatEventsDuringLoad?.clear();
    this.timelineEntries = [];
    this.chatHasOlder = false;
    this.chatOlderError = '';
    this.chatScrollRestore = undefined;
    this.timelineError = '';
    this.timelineLoading = false;
    this.feedDraft = '';
    this.chatDraft = '';
    this.replyingToCommunityMessage = null;
    this.chatDeliveryUncertain = false;
    this.pendingChatDelivery = undefined;
    this.errorMessage = '';

    this.communityService.get(community.id)
      .pipe(
        timeout(10_000),
        retry({ count: 1 })
      )
      .subscribe({
      next: full => {
        if (openVersion !== this.communityOpenRequestVersion) return;
        this.selected = full;
        this.resetHistoricalLinks();
        const requestedTab = this.route.snapshot.queryParamMap.get('tab');
        const requestedMembers = requestedTab === 'members';
        const openJoinRequests = requestedMembers
          && (full.myRole === 'OWNER' || full.myRole === 'ADMIN');
        this.activeTab = requestedMembers ? 'members'
          : requestedTab === 'feed' ? 'feed'
          : requestedTab === 'chat' ? 'chat'
          : requestedTab === 'tournaments' && this.hasCompetitions(full) ? 'tournaments'
          : requestedTab === 'ranking' && (full.rankingsEnabled || this.hasCompetitions(full)) ? 'ranking'
          : requestedTab === 'stats' && full.rankingsEnabled ? 'stats'
          : requestedTab === 'sessions' ? 'sessions'
          : 'home';
        // Archive-only communities reveal the History tab after the async lists load.
        this.pendingArchiveDeepLinkCommunityId = requestedTab === 'ranking' && this.activeTab === 'home'
          ? full.id : null;
        this.inviteUsername = '';
        this.inviteSearchResults = [];
        this.inviteSearchPerformed = false;
        this.inviteMessage = '';
        this.groupInviteFeedback = '';
        this.selectedJoinRequestIds.clear();
        this.confirmingBatchJoin = false;
        this.batchJoinFeedback = '';
        this.roundDeleteConfirmId = undefined;
        this.roundSportDraft = '';
        this.roundEventTypeDraft = '';
        this.roundDisciplineDraft = '';
        this.importSportDraft = '';
        this.racketMatchFormat = 'SINGLES';
        this.racketSetScores = [{sideA: null,sideB: null},{sideA: null,sideB: null}];
        this.selectedSeasonId = null;
        this.closeSeasonConfirming = false;
        this.prepareRoundEntries(full);
        this.archiveSummaries = [];
        this.archiveOpen = undefined;
        this.archiveConfirmed = undefined;
        this.matchArchiveSummaries = [];
        this.matchArchiveOpen = undefined;
        this.matchArchiveConfirmed = undefined;
        this.resetArchiveDraft();
        this.loadMatchArchives(full.id);
        this.loadArchivedStandings(full.id);
        this.loadCompetition(full);
        this.loadCommunitySessions(full);
        if (this.activeTab === 'feed' || this.activeTab === 'chat') this.loadTimeline();
        if (this.activeTab === 'members') this.loadHistoricalLinks(full.id);
        if (openJoinRequests) this.loadPendingJoinRequests(full.id);
      },
      error: () => {
        if (openVersion === this.communityOpenRequestVersion) {
          this.errorMessage = t('feedback.communities.openError');
        }
      }
    });
  }

  setTab(tab: CommunityTab): void {
    if ((tab === 'tournaments' && !this.hasCompetitions(this.selected))
        || (tab === 'ranking' && !this.canBrowseHistoricalArchives)
        || (tab === 'stats' && !this.selected?.rankingsEnabled)) return;
    this.activeTab = tab;
    this.replyingToCommunityMessage = null;
    this.chatDeliveryUncertain = false;
    this.pendingChatDelivery = undefined;
    ++this.timelineRequestVersion;
    this.chatEventsDuringLoad?.clear();
    this.timelineEntries = [];
    this.chatHasOlder = false;
    this.chatOlderError = '';
    this.chatScrollRestore = undefined;
    this.timelineError = '';
    this.timelineLoading = false;
    if (tab === 'feed' || tab === 'chat') this.loadTimeline();
    this.pendingArchiveDeepLinkCommunityId = null;
    this.errorMessage = '';

    if (tab === 'members' && this.selected) {
      this.loadHistoricalLinks(this.selected.id);
      if (this.canManage()) this.loadPendingJoinRequests(this.selected.id);
    }
  }

  private resetHistoricalLinks(): void {
    this.historicalPlayers = [];
    this.historicalPlayersLoading = false;
    this.historicalPlayersError = '';
    this.historicalPlayerId = null;
    this.historicalClaimAcknowledged = false;
    this.historicalClaimSaving = false;
    this.historicalClaimMessage = '';
    this.historicalClaims = [];
    this.historicalClaimsLoading = false;
    this.historicalClaimsError = '';
    this.historicalReleaseId = null;
  }

  loadHistoricalLinks(communityId: number): void {
    if (this.selected?.id !== communityId) return;
    this.historicalClaimsLoading = true;
    this.historicalClaimsError = '';
    this.communityService.myHistoricalClaims(communityId)
      .pipe(timeout(10_000), finalize(() => {
        if (this.selected?.id === communityId) this.historicalClaimsLoading = false;
      }))
      .subscribe({
        next: claims => {
          if (this.selected?.id === communityId) this.historicalClaims = claims;
        },
        error: () => {
          if (this.selected?.id === communityId) this.historicalClaimsError = t('communities.identity.loadError');
        }
      });
    this.historicalPlayersLoading = true;
    this.historicalPlayersError = '';
    this.communityService.historicalPlayerCandidates(communityId)
      .pipe(timeout(10_000), finalize(() => {
        if (this.selected?.id === communityId) this.historicalPlayersLoading = false;
      }))
      .subscribe({
        next: players => {
          if (this.selected?.id === communityId) this.historicalPlayers = players;
        },
        error: () => {
          if (this.selected?.id === communityId) this.historicalPlayersError = t('communities.identity.loadError');
        }
      });
  }

  claimHistoricalName(): void {
    if (!this.selected || this.historicalClaimSaving || !this.historicalClaimAcknowledged ||
        this.historicalPlayerId === null ||
        !this.availableHistoricalPlayers.some(player => player.playerId === this.historicalPlayerId)) return;
    const communityId = this.selected.id;
    this.historicalClaimSaving = true;
    this.historicalClaimMessage = '';
    this.historicalPlayersError = '';
    this.communityService.claimHistoricalPlayer(communityId, this.historicalPlayerId)
      .pipe(timeout(10_000), finalize(() => {
        if (this.selected?.id === communityId) this.historicalClaimSaving = false;
      }))
      .subscribe({
        next: () => {
          if (this.selected?.id !== communityId) return;
          this.historicalPlayerId = null;
          this.historicalClaimAcknowledged = false;
          this.historicalClaimMessage = t('communities.identity.claimed');
          this.loadHistoricalLinks(communityId);
          this.loadCompetition(this.selected, this.selectedSeasonId);
        },
        error: error => {
          if (this.selected?.id === communityId) {
            this.historicalPlayersError = error.error?.message || t('communities.identity.claimError');
          }
        }
      });
  }

  releaseHistoricalName(link: HistoricalPlayerLink): void {
    if (!this.selected || this.historicalReleaseId !== null ||
        !this.historicalClaims.some(claim => claim.id === link.id)) return;
    const communityId = this.selected.id;
    this.historicalReleaseId = link.id;
    this.historicalClaimsError = '';
    this.communityService.releaseHistoricalClaim(communityId, link.id)
      .pipe(timeout(10_000), finalize(() => {
        if (this.selected?.id === communityId) this.historicalReleaseId = null;
      }))
      .subscribe({
        next: () => {
          if (this.selected?.id !== communityId) return;
          this.historicalClaimMessage = t('communities.identity.released');
          this.loadHistoricalLinks(communityId);
          this.loadCompetition(this.selected, this.selectedSeasonId);
        },
        error: error => {
          if (this.selected?.id === communityId) {
            this.historicalClaimsError = error.error?.message || t('communities.identity.releaseError');
          }
        }
      });
  }

  private loadPendingJoinRequests(communityId: number): void {
    const lookupVersion = ++this.pendingRequestsLookupVersion;
    this.pendingJoinRequestsLoading = true;
    this.communityService.pendingJoinRequests(communityId)
      .pipe(
        timeout(10_000),
        finalize(() => {
          if (lookupVersion === this.pendingRequestsLookupVersion) {
            this.pendingJoinRequestsLoading = false;
          }
        })
      )
      .subscribe({
        next: requests => {
          if (lookupVersion !== this.pendingRequestsLookupVersion
              || this.selected?.id !== communityId) return;
          this.pendingJoinRequests = requests;
          this.selectedJoinRequestIds.clear();
          this.confirmingBatchJoin = false;
        },
        error: () => {
          if (lookupVersion !== this.pendingRequestsLookupVersion
              || this.selected?.id !== communityId) return;
          this.pendingJoinRequests = [];
          this.selectedJoinRequestIds.clear();
          this.confirmingBatchJoin = false;
          this.errorMessage = t('feedback.communities.joinRequestsLoadError');
        }
      });
  }

  selectedJoinRequestCount(): number {
    return this.pendingJoinRequests.filter(request => this.selectedJoinRequestIds.has(request.id)).length;
  }

  allJoinRequestsSelected(): boolean {
    return this.pendingJoinRequests.length > 0
      && this.selectedJoinRequestCount() === this.pendingJoinRequests.length;
  }

  selectJoinRequest(id: number, checked: boolean): void {
    if (this.batchJoining || this.joinRequestActionId !== undefined) return;
    if (checked) this.selectedJoinRequestIds.add(id);
    else this.selectedJoinRequestIds.delete(id);
    this.confirmingBatchJoin = false;
    this.batchJoinFeedback = '';
  }

  toggleAllJoinRequests(): void {
    if (this.batchJoining || this.joinRequestActionId !== undefined) return;
    this.selectedJoinRequestIds = this.allJoinRequestsSelected()
      ? new Set<number>()
      : new Set(this.pendingJoinRequests.map(request => request.id));
    this.confirmingBatchJoin = false;
    this.batchJoinFeedback = '';
  }

  beginBatchApproval(): void {
    if (!this.selected || !this.canManage() || this.batchJoining
        || this.joinRequestActionId !== undefined || this.selectedJoinRequestCount() === 0) return;
    this.confirmingBatchJoin = true;
    this.batchJoinFeedback = '';
  }

  cancelBatchApproval(): void {
    this.confirmingBatchJoin = false;
  }

  async confirmBatchApproval(): Promise<void> {
    const communityId = this.selected?.id;
    if (!communityId || !this.canManage() || !this.confirmingBatchJoin
        || this.batchJoining || this.joinRequestActionId !== undefined) return;
    const requests = this.pendingJoinRequests.filter(request => this.selectedJoinRequestIds.has(request.id));
    this.confirmingBatchJoin = false;
    if (!requests.length) return;

    // An earlier pending-list GET must not resurrect approved requests.
    ++this.pendingRequestsLookupVersion;
    this.pendingJoinRequestsLoading = false;
    this.batchJoining = true;
    this.batchJoinFeedback = '';
    this.batchJoinTotal = requests.length;
    this.batchJoinProcessed = 0;
    let approved = 0;
    let failed = 0;

    try {
      for (const request of requests) {
        try {
          await firstValueFrom(
            this.communityService.acceptJoinRequest(communityId, request.id).pipe(timeout(10_000))
          );
          approved++;
          this.selectedJoinRequestIds.delete(request.id);
          if (this.selected?.id === communityId) {
            this.pendingJoinRequests = this.pendingJoinRequests.filter(item => item.id !== request.id);
          }
        } catch {
          failed++;
        }
        this.batchJoinProcessed++;
      }
    } finally {
      this.batchJoining = false;
    }
    if (this.selected?.id === communityId) {
      if (approved) this.refreshSelected();
      this.batchJoinFeedback = failed
        ? t('communities.batchApprovalPartial', { approved, failed })
        : t('communities.batchApprovalSuccess', { count: approved });
    }
  }

  acceptPendingJoinRequest(request: CommunityJoinRequest): void {
    if (!this.selected || this.joinRequestActionId !== undefined || this.batchJoining) {
      return;
    }

    ++this.pendingRequestsLookupVersion;
    this.pendingJoinRequestsLoading = false;
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
          this.selectedJoinRequestIds.delete(request.id);
          this.confirmingBatchJoin = false;
          this.refreshSelected();
        },
        error: error => {
          this.errorMessage = error.error?.message
            || t('feedback.communities.joinRequestActionError');
        }
      });
  }

  rejectPendingJoinRequest(request: CommunityJoinRequest): void {
    if (!this.selected || this.joinRequestActionId !== undefined || this.batchJoining) {
      return;
    }

    ++this.pendingRequestsLookupVersion;
    this.pendingJoinRequestsLoading = false;
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
          this.selectedJoinRequestIds.delete(request.id);
          this.confirmingBatchJoin = false;
        },
        error: error => {
          this.errorMessage = error.error?.message
            || t('feedback.communities.joinRequestActionError');
        }
      });
  }

  loadCommunitySessions(community: CommunityGroup = this.selected as CommunityGroup): void {
    const requestVersion = (this.communitySessionsRequestVersion || 0) + 1;
    this.communitySessionsRequestVersion = requestVersion;
    if (!community) {
      this.communitySessions = [];
      return;
    }

    this.sessionsLoading = true;
    this.communityService.sessions(community.id)
      .pipe(
        timeout(10_000),
        retry({ count: 1 }),
        finalize(() => {
          if (requestVersion === this.communitySessionsRequestVersion) this.sessionsLoading = false;
        })
      )
      .subscribe({
        next: sessions => {
          if (requestVersion !== this.communitySessionsRequestVersion ||
              this.selected?.id !== community.id) return;
          this.communitySessions = sessions;
        },
        error: () => {
          if (requestVersion !== this.communitySessionsRequestVersion ||
              this.selected?.id !== community.id) return;
          this.communitySessions = [];
          this.errorMessage = t('feedback.communities.sessionsLoadError');
        }
      });
  }

  canJoinCommunitySession(session: SessionSummary): boolean {
    const start = Date.parse(session.gameDate);
    return !session.privateGame
      && !session.joinedByViewer
      && !session.waitlistedByViewer
      && (session.status === 'OPEN' || session.status === 'FULL')
      && Number.isFinite(start) && start > Date.now();
  }

  joinCommunitySession(session: SessionSummary): void {
    if (!this.selected || this.joiningSessionId !== undefined
        || !this.canJoinCommunitySession(session)) {
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

  canOpenSessionToPublic(session: SessionSummary): boolean {
    const start = Date.parse(session.gameDate);
    return this.canManage()
      && session.audience === 'COMMUNITY_ONLY'
      && (session.status === 'OPEN' || session.status === 'FULL')
      && Number.isFinite(start) && start > Date.now()
      && session.participantCount < session.maxParticipants;
  }

  openSessionToPublic(session: SessionSummary): void {
    if (!this.selected || !this.canOpenSessionToPublic(session)
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

    const requestVersion = (this.competitionRequestVersion || 0) + 1;
    this.competitionRequestVersion = requestVersion;
    this.competitionLoading = true;
    this.communityService.competition(community.id, seasonId)
      .pipe(
        timeout(10_000),
        retry({ count: 1 }),
        finalize(() => {
          if (requestVersion === this.competitionRequestVersion) this.competitionLoading = false;
        })
      )
      .subscribe({
        next: competition => {
          if (requestVersion !== this.competitionRequestVersion ||
              this.selected?.id !== community.id) return;
          this.competition = competition;
          if (!this.canConfigureRacketRules()) this.racketRuleEditorKey = null;
          if (!this.canManageRaceChampionship()) {
            this.raceRuleSport = null;
            this.racePenaltyEditorKey = null;
            this.raceDecisionEditorKey = null;
          }
          this.maxStandingPoints = Math.max(
            0,
            ...competition.standings.map(item => item.points)
          );
          this.topGoalsStanding = competition.standings.reduce<CommunityStanding | undefined>(
            (best, row) => !best || row.goals > best.goals || (row.goals === best.goals && row.position < best.position) ? row : best,
            undefined
          );
          this.topAssistsStanding = competition.standings.reduce<CommunityStanding | undefined>(
            (best, row) => !best || row.assists > best.assists || (row.assists === best.assists && row.position < best.position) ? row : best,
            undefined
          );
          this.topMvpsStanding = competition.standings.reduce<CommunityStanding | undefined>(
            (best, row) => !best || row.mvps > best.mvps || (row.mvps === best.mvps && row.position < best.position) ? row : best,
            undefined
          );
          this.topCleanSheetsStanding = competition.standings.reduce<CommunityStanding | undefined>(
            (best, row) => !best || row.cleanSheets > best.cleanSheets || (row.cleanSheets === best.cleanSheets && row.position < best.position) ? row : best,
            undefined
          );
          this.mostGamesStanding = competition.standings.reduce<CommunityStanding | undefined>(
            (best, row) => !best || row.games > best.games || (row.games === best.games && row.position < best.position) ? row : best,
            undefined
          );
          this.bestWinRateStanding = competition.standings.reduce<CommunityStanding | undefined>(
            (best, row) => !best || row.winRate > best.winRate || (row.winRate === best.winRate && row.position < best.position) ? row : best,
            undefined
          );
          this.bestWinStreakStanding = competition.standings.reduce<CommunityStanding | undefined>(
            (best, row) => !best || row.bestWinStreak > best.bestWinStreak || (row.bestWinStreak === best.bestWinStreak && row.position < best.position) ? row : best,
            undefined
          );
          this.standingsByUsername = new Map<string, CommunityStanding>(
            competition.standings.filter(row => row.username !== null)
              .map(row => [row.username!, row])
          );
          this.activeCommunitySeason = competition.seasons.find(
            season => season.id === competition.activeSeasonId
          );
          this.communityTrophies = competition.seasons.filter(
            season => !season.active && Boolean(season.championUsername)
          );
          this.selectedSeasonId = competition.selectedSeasonId;
          if (this.editingSeasonId !== null &&
              !competition.seasons.some(item => item.id === this.editingSeasonId)) this.editingSeasonId = null;
          if (this.deletingSeasonId !== null &&
              !competition.seasons.some(item => item.id === this.deletingSeasonId)) this.deletingSeasonId = null;
          this.rankingsEnabledDraft = competition.settings.rankingsEnabled;
          this.winPointsDraft = competition.settings.winPoints;
          this.drawPointsDraft = competition.settings.drawPoints;
          this.lossPointsDraft = competition.settings.lossPoints;
        },
        error: () => {
          if (requestVersion !== this.competitionRequestVersion ||
              this.selected?.id !== community.id) return;
          this.competition = undefined;
          this.maxStandingPoints = 0;
          this.topGoalsStanding = undefined;
          this.topAssistsStanding = undefined;
          this.topMvpsStanding = undefined;
          this.topCleanSheetsStanding = undefined;
          this.mostGamesStanding = undefined;
          this.bestWinRateStanding = undefined;
          this.bestWinStreakStanding = undefined;
          this.standingsByUsername.clear();
          this.activeCommunitySeason = undefined;
          this.communityTrophies = [];
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


  editSeason(season: CommunitySeason): void {
    if (!this.selected || !this.canManage() || this.seasonActionSaving) return;
    this.editingSeasonId = season.id;
    this.editingSeasonName = season.name;
    this.deletingSeasonId = null;
    this.seasonActionError = '';
    this.seasonActionMessage = '';
  }

  requestDeleteSeason(season: CommunitySeason): void {
    if (!this.selected || !this.canManage() || this.seasonActionSaving) return;
    this.deletingSeasonId = season.id;
    this.seasonDeleteAcknowledged = false;
    this.editingSeasonId = null;
    this.editingSeasonName = '';
    this.seasonActionError = '';
    this.seasonActionMessage = '';
  }

  cancelSeasonAction(): void {
    if (this.seasonActionSaving) return;
    this.editingSeasonId = null;
    this.editingSeasonName = '';
    this.deletingSeasonId = null;
    this.seasonDeleteAcknowledged = false;
    this.seasonActionError = '';
  }

  saveSeasonName(season: CommunitySeason): void {
    const name = this.editingSeasonName.trim();
    if (!this.selected || !this.canManage() || this.seasonActionSaving
        || this.editingSeasonId !== season.id) return;
    if (!name || name.length > 120) {
      this.seasonActionError = t('feedback.communities.seasonNameInvalid');
      return;
    }
    const communityId = this.selected.id;
    this.seasonActionSaving = true;
    this.seasonActionError = '';
    this.seasonActionMessage = '';
    this.communityService.renameSeason(communityId, season.id, name)
      .pipe(timeout(10_000), finalize(() => this.seasonActionSaving = false))
      .subscribe({
        next: () => {
          if (this.selected?.id !== communityId) return;
          this.editingSeasonId = null;
          this.editingSeasonName = '';
          this.seasonActionMessage = t('communities.seasonRenamed');
          this.loadCompetition(this.selected, this.selectedSeasonId);
        },
        error: () => {
          if (this.selected?.id === communityId)
            this.seasonActionError = t('feedback.communities.seasonRenameError');
        }
      });
  }

  confirmDeleteSeason(season: CommunitySeason): void {
    if (!this.selected || !this.canManage() || this.seasonActionSaving
        || this.deletingSeasonId !== season.id || !this.seasonDeleteAcknowledged) return;
    const communityId = this.selected.id;
    this.seasonActionSaving = true;
    this.seasonActionError = '';
    this.seasonActionMessage = '';
    this.communityService.deleteSeason(communityId, season.id)
      .pipe(timeout(10_000), finalize(() => this.seasonActionSaving = false))
      .subscribe({
        next: () => {
          if (this.selected?.id !== communityId) return;
          this.deletingSeasonId = null;
          this.seasonDeleteAcknowledged = false;
          if (this.selectedSeasonId === season.id) this.selectedSeasonId = null;
          this.seasonActionMessage = t('communities.seasonDeleted');
          this.loadCompetition(this.selected, this.selectedSeasonId);
        },
        error: (error: HttpErrorResponse) => {
          if (this.selected?.id !== communityId) return;
          this.seasonActionError = error.status === 409
            ? t('feedback.communities.seasonDeleteConflict')
            : t('feedback.communities.seasonDeleteError');
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
      cleanSheet: false,
      finishPosition: null,
      elapsedSeconds: null,
      bestLapSeconds: null,
      lapsCompleted: null,
      performanceValue: null,
      waveScore1: null,
      waveScore2: null
    }));
  }

  get importIncludesPoints(): boolean {
    return this.importMappings?.some(mapping => mapping.field === 'POINTS') ?? false;
  }

  selectImportMode(mode: 'ROUNDS' | 'STANDINGS' | 'MATCHES'): void {
    if (this.importMode === mode) return;
    this.importMode = mode;
    this.importFileError = '';
    // The uploaded file has already been inspected: reuse it when changing the chosen kind of history.
    if (this.importPreview) this.selectImportSheet(this.importSheetName);
    else this.resetImportAfterFile();
  }

  private normalizedHeader(header: string): string {
    return header.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .trim().toLowerCase().replace(/[\s._-]+/g, '');
  }

  get recommendedImportMode(): 'ROUNDS' | 'STANDINGS' | 'MATCHES' | null {
    const sheet = this.importPreview?.sheets.find(item => item.name === this.importSheetName);
    if (!sheet) return null;
    const headers = new Set(sheet.headers.map(header => this.normalizedHeader(header)));
    const has = (...names: string[]) => names.some(name => headers.has(name));
    const player = has('cepo', 'jogador', 'player', 'nome', 'name', 'atleta', 'participante');
    if (player && has('data', 'date', 'dia') &&
      has('v', 'w', 'win', 'wins', 'd', 'derrota', 'derrotas', 'resultado')) return 'ROUNDS';
    if (has('casa', 'home', 'equipa1', 'equipaa', 'jogador1') &&
      has('fora', 'away', 'equipa2', 'equipab', 'jogador2') &&
      has('resultado', 'score', 'homescore', 'goloscasa', 'golosfora')) return 'MATCHES';
    if (player && has('pontos', 'pts', 'points')) return 'STANDINGS';
    return null;
  }

  get importSheetLooksLikePivot(): boolean {
    const sheet = this.importPreview?.sheets.find(item => item.name === this.importSheetName);
    return !!sheet && (sheet.structure === 'PIVOT' ||
      sheet.headers.some(header => /^(sum of|column labels|row labels|grand total)/i.test(header)));
  }

  importFieldLabel(field: string): string {
    return t('communities.import.field.' + field);
  }

  /**
   * Known English headings from uploaded spreadsheets should be presented in
   * the selected UI language. Keep the original Excel header in mapping.header
   * so the importer still uses exactly the original source column.
   */
  importColumnHeaderLabel(header: string): string {
    const keyByHeader: Record<string, string> = {
      player: 'PLAYER', players: 'PLAYER', playername: 'PLAYER',
      win: 'WIN', wins: 'WINS', draw: 'DRAW', draws: 'DRAWS',
      loss: 'LOSS', losses: 'LOSSES',
      date: 'DATE', result: 'RESULT', goals: 'GOALS',
      assists: 'ASSISTS', points: 'POINTS',
      name: 'NAME', position: 'POSITION', played: 'PLAYED',
      home: 'HOME', away: 'AWAY', score: 'SCORE',
      homescore: 'HOME_SCORE', awayscore: 'AWAY_SCORE'
    };
    const field = keyByHeader[this.normalizedHeader(header)];
    return field ? this.importFieldLabel(field) : header;
  }

  importPreviewResultLabel(row: {
    result?: string | null; win?: boolean | number | null;
    draw?: boolean | number | null; loss?: boolean | number | null;
  }): string {
    const value = String(row.result || (row.win ? 'WIN'
      : row.draw ? 'DRAW' : row.loss ? 'LOSS' : '')).trim().toUpperCase();
    switch (value) {
      case 'WIN': return t('communities.result.win');
      case 'DRAW': return t('communities.result.draw');
      case 'LOSS': return t('communities.result.loss');
      default: return value || '—';
    }
  }

  private validImportFields(mode: 'ROUNDS' | 'STANDINGS' | 'MATCHES'): boolean {
    const fields = new Set(this.importMappings.map(mapping => mapping.field));
    if (mode === 'ROUNDS') return fields.has('PLAYER');
    if (mode === 'STANDINGS') return fields.has('NAME') && fields.has('POINTS');
    return fields.has('HOME') && fields.has('AWAY') &&
      (fields.has('SCORE') || (fields.has('HOME_SCORE') && fields.has('AWAY_SCORE')));
  }

  private resetArchiveDraft(): void {
    this.matchPreview = undefined;
    this.matchArchiveConfirmed = undefined;
    this.matchArchiveAcknowledged = false;
    this.archivePreview = undefined;
    this.archiveConfirmed = undefined;
    this.archiveAcknowledged = false;
  }

  private resetImportAfterFile(): void {
    ++this.importRevision;
    this.sourceDatesNeedYear = false;
    this.resetArchiveDraft();
    this.importPointsAcknowledged = false;
    this.importSheetName = '';
    this.importSourceCompetition = '';
    this.importSourceRound = '';
    this.importMappings = [];
    this.importValidation = undefined;
    this.importNormalized = undefined;
    this.importFinalPlan = undefined;
    this.importResult = undefined;
  }

  private resetImportAfterMapping(): void {
    ++this.importRevision;
    this.resetArchiveDraft();
    this.importPointsAcknowledged = false;
    this.importValidation = undefined;
    this.importNormalized = undefined;
    this.importFinalPlan = undefined;
    this.importResult = undefined;
  }

  onImportFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    this.importFileError = '';
    // Clear the previous import plan even when a replacement file is rejected.
    this.importFile = undefined;
    this.importFileName = '';
    this.importPreview = undefined;
    this.resetImportAfterFile();

    if (!file) return;

    if (!/\.(xlsx|xls|csv|tsv)$/i.test(file.name)) {
      this.importFileError = t('communities.import.invalidFile');
      input.value = '';
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      this.importFileError = t('communities.import.tooLarge');
      input.value = '';
      return;
    }

    this.importFile = file;
    this.importFileName = file.name;
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
    this.importFileError = '';
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
        field: this.importMode === 'STANDINGS'
          ? this.suggestArchiveField(header, suggestion?.field || 'IGNORE')
          : this.importMode === 'MATCHES'
            ? this.suggestMatchField(header, suggestion?.field || 'IGNORE')
            : this.suggestRoundsField(header, suggestion?.field || 'IGNORE'),
        confidence: suggestion?.confidence || 0
      };
    });
    const dateIndex = this.importMappings.find(item => item.field === 'DATE')?.columnIndex;
    const dates = dateIndex === undefined ? [] : sheet.sampleRows
      .map(row => row[dateIndex]?.trim() || '').filter(Boolean);
    this.sourceDatesNeedYear = this.importMode === 'ROUNDS' &&
      dates.some(date => /^\d{1,2}\s+[\p{L}.]+$/u.test(date) || /^\d{1,2}[-/.]\d{1,2}$/.test(date));
    if (this.sourceDatesNeedYear) this.importDefaultYear = null;
  }

  private suggestRoundsField(header: string, suggestion: string): string {
    const normalized = this.normalizedHeader(header);
    if (/^(cepo|jogador|jogadores|player|players|atleta|participante|nome|name)$/.test(normalized)) return 'PLAYER';
    if (/^(d|der|derrota|derrotas|loss|losses)$/.test(normalized)) return 'LOSS';
    if (/^(v|vit|vitoria|vitorias|win|wins)$/.test(normalized)) return 'WIN';
    if (/^(e|empate|empates|draw|draws)$/.test(normalized)) return 'DRAW';
    if (/^(pontos|pts|points|pontuacao)$/.test(normalized)) return 'POINTS';
    if (/^(data|date|dia|jornada)$/.test(normalized)) return 'DATE';
    return this.importFields.includes(suggestion) ? suggestion : 'IGNORE';
  }

  private suggestArchiveField(header: string, suggestion: string): string {
    const normalized = header.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .trim().toLowerCase().replace(/[\s._-]+/g, '');
    if (/^(pos|posicao|position|rank|ranking|classificacao|lugar|#)$/.test(normalized)) return 'POSITION';
    if (/^(equipa|equipes|team|teams|jogador|jogadores|player|players|atleta|nome|name)$/.test(normalized)) return 'NAME';
    if (/^(j|pj|jogos|partidas|played|games|matches)$/.test(normalized)) return 'PLAYED';
    if (/^(v|vit|vitorias|wins)$/.test(normalized)) return 'WINS';
    if (/^(e|emp|empates|draws)$/.test(normalized)) return 'DRAWS';
    if (/^(d|der|derrotas|losses)$/.test(normalized)) return 'LOSSES';
    if (/^(gm|gf|golosmarcados|goalsfor)$/.test(normalized)) return 'GOALS_FOR';
    if (/^(gs|ga|golossofridos|goalsagainst)$/.test(normalized)) return 'GOALS_AGAINST';
    if (/^(pts|pontos|points|p)$/.test(normalized)) return 'POINTS';
    if (suggestion === 'PLAYER') return 'NAME';
    if (suggestion === 'GOALS') return 'GOALS_FOR';
    return this.importFields.includes(suggestion) ? suggestion : 'IGNORE';
  }

  private suggestMatchField(header: string, suggestion: string): string {
    const normalized = header.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .trim().toLowerCase().replace(/[\s._-]+/g, '');
    if (/^(casa|home|mandante|equipa1|equipaa|jogador1|jogadora|team1|teama|player1|playera)$/.test(normalized)) return 'HOME';
    if (/^(fora|away|visitante|equipa2|equipab|jogador2|jogadorb|team2|teamb|player2|playerb)$/.test(normalized)) return 'AWAY';
    if (/^(resultadocasa|golescasa|goloscasa|golos1|golosde1|homescore|scorehome|score1)$/.test(normalized)) return 'HOME_SCORE';
    if (/^(resultadofora|golesfora|golosfora|golos2|golosde2|awayscore|scoreaway|score2)$/.test(normalized)) return 'AWAY_SCORE';
    if (/^(resultado|result|score|placar|marcador)$/.test(normalized)) return 'SCORE';
    if (/^(data|date|datadojogo|matchdate)$/.test(normalized)) return 'DATE';
    if (/^(jornada|round|ronda|rodada|matchday)$/.test(normalized)) return 'ROUND';
    if (suggestion === 'DATE') return 'DATE';
    if (suggestion === 'RESULT') return 'SCORE';
    return 'IGNORE';
  }

  previewHistoricalMatches(): void {
    if (!this.selected || !this.canManage() || !this.importFile || !this.importSheetName
        || this.importMode !== 'MATCHES' || this.matchPreviewLoading) return;
    if (!this.validImportFields('MATCHES')) {
      this.importFileError = t('communities.matches.fieldsRequired');
      return;
    }
    const communityId = this.selected.id;
    const file = this.importFile;
    const mapping = this.historicalMapping();
    const revision = this.importRevision;
    this.matchPreview = undefined;
    this.matchArchiveConfirmed = undefined;
    this.matchArchiveAcknowledged = false;
    this.importFileError = '';
    this.matchPreviewLoading = true;
    this.communityService.previewHistoricalMatches(communityId, file, mapping)
      .pipe(timeout(20_000), finalize(() => this.matchPreviewLoading = false))
      .subscribe({
        next: preview => {
          if (this.selected?.id === communityId && this.importMode === 'MATCHES'
              && this.importFile === file && this.importSheetName === mapping.sheetName
              && this.importRevision === revision) {
            this.matchPreview = preview;
          }
        },
        error: error => {
          if (this.selected?.id === communityId && this.importMode === 'MATCHES'
              && this.importFile === file && this.importRevision === revision) {
            this.importFileError = error.error?.message || t('communities.matches.previewError');
          }
        }
      });
  }

  confirmMatchArchive(): void {
    if (!this.selected || !this.canManage() || this.importMode !== 'MATCHES' ||
        !this.importFile || !this.importSheetName || !this.matchPreview ||
        this.matchPreview.acceptedRows < 1 || this.matchArchiveConfirming || this.matchPreviewLoading) return;
    if (this.matchArchiveTitle.trim().length < 2 || this.matchArchiveTitle.trim().length > 120 ||
        !this.matchArchiveAcknowledged) {
      this.importFileError = t('communities.matches.confirmRequired');
      return;
    }
    const communityId = this.selected.id;
    const file = this.importFile;
    const mapping = this.historicalMapping();
    const context = { title: this.matchArchiveTitle.trim(), entryType: this.matchArchiveEntryType };
    this.matchArchiveConfirming = true;
    this.importFileError = '';
    this.communityService.confirmHistoricalMatches(communityId, file, mapping, context)
      .pipe(timeout(30_000), finalize(() => this.matchArchiveConfirming = false))
      .subscribe({
        next: archive => {
          if (this.selected?.id !== communityId) return;
          this.matchArchiveConfirmed = archive;
          this.matchArchiveOpen = archive;
          this.matchArchivePage = 0;
          this.matchPreview = undefined;
          this.matchArchiveAcknowledged = false;
          this.loadMatchArchives(communityId);
        },
        error: error => {
          if (this.selected?.id === communityId) {
            this.importFileError = error.error?.message || t('communities.matches.confirmError');
          }
        }
      });
  }

  private openPendingArchiveDeepLink(communityId: number): void {
    if (this.pendingArchiveDeepLinkCommunityId !== communityId
        || this.selected?.id !== communityId || !this.canBrowseHistoricalArchives) return;
    this.activeTab = 'ranking';
    this.pendingArchiveDeepLinkCommunityId = null;
  }

  // A navigation or a newer request supersedes responses from previously viewed
  // archives. Reset the busy flags so an old detail request cannot block a new group.
  private invalidateArchiveRequests(): void {
    this.matchArchiveListRequestVersion = (this.matchArchiveListRequestVersion || 0) + 1;
    this.matchArchiveDetailRequestVersion = (this.matchArchiveDetailRequestVersion || 0) + 1;
    this.standingArchiveListRequestVersion = (this.standingArchiveListRequestVersion || 0) + 1;
    this.standingArchiveDetailRequestVersion = (this.standingArchiveDetailRequestVersion || 0) + 1;
    this.matchArchivesLoading = false;
    this.archivesLoading = false;
    this.matchArchiveOpeningId = undefined;
    this.archiveOpeningId = undefined;
  }

  loadMatchArchives(communityId: number): void {
    const requestVersion = (this.matchArchiveListRequestVersion || 0) + 1;
    this.matchArchiveListRequestVersion = requestVersion;
    this.matchArchivesLoading = true;
    this.matchArchivesError = '';
    this.communityService.listHistoricalMatches(communityId)
      .pipe(timeout(15_000), finalize(() => {
        if (requestVersion === this.matchArchiveListRequestVersion) {
          this.matchArchivesLoading = false;
        }
      }))
      .subscribe({
        next: archives => {
          if (requestVersion === this.matchArchiveListRequestVersion
              && this.selected?.id === communityId) {
            this.matchArchiveSummaries = archives;
            this.openPendingArchiveDeepLink(communityId);
          }
        },
        error: () => {
          if (requestVersion === this.matchArchiveListRequestVersion
              && this.selected?.id === communityId) {
            this.matchArchivesError = t('communities.matches.listError');
          }
        }
      });
  }

  openMatchArchive(archiveId: number): void {
    if (!this.selected || this.matchArchiveOpeningId !== undefined) return;
    const communityId = this.selected.id;
    if (this.matchArchiveOpen?.id === archiveId) {
      this.matchArchiveOpen = undefined;
      return;
    }
    const requestVersion = (this.matchArchiveDetailRequestVersion || 0) + 1;
    this.matchArchiveDetailRequestVersion = requestVersion;
    this.matchArchiveOpeningId = archiveId;
    this.matchArchivesError = '';
    this.communityService.historicalMatchDetails(communityId, archiveId)
      .pipe(timeout(15_000), finalize(() => {
        if (requestVersion === this.matchArchiveDetailRequestVersion) {
          this.matchArchiveOpeningId = undefined;
        }
      }))
      .subscribe({
        next: archive => {
          if (requestVersion !== this.matchArchiveDetailRequestVersion
              || this.selected?.id !== communityId) return;
          this.matchArchiveOpen = archive;
          this.matchArchivePage = 0;
        },
        error: () => {
          if (requestVersion === this.matchArchiveDetailRequestVersion
              && this.selected?.id === communityId) {
            this.matchArchivesError = t('communities.matches.detailError');
          }
        }
      });
  }

  private historicalMapping(): { sheetName: string; columns: Array<{ columnIndex: number; field: string }> } {
    return { sheetName: this.importSheetName,
      columns: this.importMappings.map(item => ({ columnIndex: item.columnIndex, field: item.field })) };
  }

  previewArchiveImport(): void {
    if (!this.selected || !this.canManage() || !this.importFile || !this.importSheetName ||
        this.importMode !== 'STANDINGS' || this.archivePreviewLoading) return;
    if (!this.validImportFields('STANDINGS')) {
      this.importFileError = t('communities.archive.fieldsRequired');
      return;
    }
    const communityId = this.selected.id;
    this.resetArchiveDraft();
    this.importFileError = '';
    const mapping = this.historicalMapping();
    this.archivePreviewLoading = true;
    this.communityService.previewHistoricalStandings(communityId, this.importFile, mapping)
      .pipe(timeout(20_000), finalize(() => this.archivePreviewLoading = false))
      .subscribe({
        next: preview => {
          if (this.selected?.id === communityId && this.importMode === 'STANDINGS') {
            this.archivePreview = preview;
          }
        },
        error: error => {
          if (this.selected?.id === communityId) {
            this.importFileError = error.error?.message || t('communities.archive.previewError');
          }
        }
      });
  }

  confirmArchiveImport(): void {
    if (!this.selected || !this.canManage() || this.importMode !== 'STANDINGS' ||
        !this.importFile || !this.archivePreview || this.importConfirming) return;
    if (this.archiveTitle.trim().length < 2 || this.archiveTitle.trim().length > 120 ||
        !this.archiveAcknowledged) {
      this.importFileError = t('communities.archive.confirmRequired');
      return;
    }
    const communityId = this.selected.id;
    const context = {
      title: this.archiveTitle.trim(),
      entryType: this.archiveEntryType,
      seasonId: this.archiveSeasonId
    };
    this.importFileError = '';
    this.importConfirming = true;
    this.communityService.confirmHistoricalStandings(
      communityId, this.importFile, this.historicalMapping(), context
    ).pipe(timeout(30_000), finalize(() => this.importConfirming = false))
      .subscribe({
        next: archive => {
          if (this.selected?.id !== communityId) return;
          this.archiveConfirmed = archive;
          this.archiveOpen = archive;
          this.archivePreview = undefined;
          this.archiveAcknowledged = false;
          this.loadArchivedStandings(communityId);
        },
        error: error => {
          if (this.selected?.id === communityId) {
            this.importFileError = error.error?.message || t('communities.archive.confirmError');
          }
        }
      });
  }

  loadArchivedStandings(communityId: number): void {
    const requestVersion = (this.standingArchiveListRequestVersion || 0) + 1;
    this.standingArchiveListRequestVersion = requestVersion;
    this.archivesLoading = true;
    this.archivesError = '';
    this.communityService.listHistoricalStandings(communityId)
      .pipe(timeout(15_000), finalize(() => {
        if (requestVersion === this.standingArchiveListRequestVersion) {
          this.archivesLoading = false;
        }
      }))
      .subscribe({
        next: archives => {
          if (requestVersion === this.standingArchiveListRequestVersion
              && this.selected?.id === communityId) {
            this.archiveSummaries = archives;
            this.openPendingArchiveDeepLink(communityId);
          }
        },
        error: () => {
          if (requestVersion === this.standingArchiveListRequestVersion
              && this.selected?.id === communityId) {
            this.archivesError = t('communities.archive.listError');
          }
        }
      });
  }

  openArchivedStanding(archiveId: number): void {
    if (!this.selected || this.archiveOpeningId !== undefined) return;
    const communityId = this.selected.id;
    if (this.archiveOpen?.id === archiveId) {
      this.archiveOpen = undefined;
      return;
    }
    const requestVersion = (this.standingArchiveDetailRequestVersion || 0) + 1;
    this.standingArchiveDetailRequestVersion = requestVersion;
    this.archiveOpeningId = archiveId;
    this.archivesError = '';
    this.communityService.historicalStandingDetails(communityId, archiveId)
      .pipe(timeout(15_000), finalize(() => {
        if (requestVersion === this.standingArchiveDetailRequestVersion) {
          this.archiveOpeningId = undefined;
        }
      }))
      .subscribe({
        next: archive => {
          if (requestVersion === this.standingArchiveDetailRequestVersion
              && this.selected?.id === communityId) this.archiveOpen = archive;
        },
        error: () => {
          if (requestVersion === this.standingArchiveDetailRequestVersion
              && this.selected?.id === communityId) {
            this.archivesError = t('communities.archive.detailError');
          }
        }
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
    if (!this.validImportFields('ROUNDS')) {
      this.importFileError = t('communities.import.playerRequired');
      return;
    }

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
    this.importPointsAcknowledged = false;
    this.importFinalPlan = undefined;
    this.importResult = undefined;
    this.importFileError = '';
  }

  buildImportFinalPlan(): void {
    if (!this.selected || !this.importFile || !this.importSheetName || !this.selectedSeasonId || this.importPlanLoading) {
      this.importFileError = t('communities.import.seasonRequired');
      return;
    }
    if (this.communityRoundSports.length > 1 && !this.newImportSport) {
      this.importFileError = t('feedback.communities.roundSportRequired');
      return;
    }
    if (this.sourceDatesNeedYear && (!Number.isInteger(this.importDefaultYear) ||
        (this.importDefaultYear ?? 0) < 1900 || (this.importDefaultYear ?? 0) > 2100)) {
      this.importFileError = t('communities.import.explicitYearRequired');
      return;
    }
    const mapping = {
      sheetName: this.importSheetName,
      columns: this.importMappings.map(item => ({ columnIndex: item.columnIndex, field: item.field }))
    };
    const context = {
      seasonId: this.selectedSeasonId,
      defaultYear: this.importDefaultYear || null,
      sourceCompetition: this.importSourceCompetition?.trim() || null,
      sourceRound: this.importSourceRound?.trim() || null,
      ...(this.newImportSport ? { sport: this.newImportSport } : {})
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
    if (this.communityRoundSports.length > 1 && !this.newImportSport) {
      this.importFileError = t('feedback.communities.roundSportRequired');
      return;
    }
    if (this.importIncludesPoints && !this.importPointsAcknowledged) {
      this.importFileError = t('communities.import.pointsAcknowledgementRequired');
      return;
    }
    if (this.importFinalPlan.invalidDates > 0 || this.importFinalPlan.roundsNeedingYear > 0 ||
        this.importFinalPlan.rounds.some((round: any) => round.unresolvedResults > 0)) {
      this.importFileError = t('communities.import.notReady');
      return;
    }
    const mapping = { sheetName: this.importSheetName, columns: this.importMappings.map(item => ({ columnIndex: item.columnIndex, field: item.field })) };
    const context = {
      seasonId: this.selectedSeasonId,
      defaultYear: this.importDefaultYear || null,
      sourceCompetition: this.importSourceCompetition?.trim() || null,
      sourceRound: this.importSourceRound?.trim() || null,
      ...(this.newImportSport ? { sport: this.newImportSport } : {})
    };
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
    if (this.communityRoundSports.length > 1 && !this.newRoundSport) {
      this.errorMessage = t('feedback.communities.roundSportRequired');
      return;
    }
    if (eventOptionsForSport(this.newRoundSport).length && !this.newRoundEventType) {
      this.errorMessage = t('feedback.communities.roundEventTypeRequired');
      return;
    }
    if (!athleticsDisciplineValid(this.newRoundSport, this.newRoundEventType,
      this.roundDisciplineDraft || null)) {
      this.errorMessage = t('feedback.communities.disciplineRequired');
      return;
    }
    const race = this.viewForNewRound() === 'race';
    const neutral = isNeutralEvent(this.newRoundSport, this.newRoundEventType);
    const breaking = this.newRoundEventType === 'BREAKING_BATTLE';
    const racket = racketSupportsSets(this.newRoundSport);

    const selectedEntries = this.roundEntries.filter(entry => entry.included);
    const racketWinner = racket
      ? racketMatchWinner(selectedEntries, this.racketMatchFormat, this.racketSetScores)
      : null;
    if (racket && !racketWinner) {
      this.errorMessage = t('feedback.communities.racketInvalidScore');
      return;
    }
    if (neutral && isWaveHeatEvent(this.newRoundEventType) && surfWaveError(selectedEntries)) {
      this.errorMessage = t(this.newRoundEventType === 'BODYBOARD_HEAT'
        ? 'feedback.communities.bodyboardInvalid' : 'feedback.communities.surfInvalid');
      return;
    }
    if (this.newRoundEventType === 'BREAKING_BATTLE' && breakingBattleError(selectedEntries)) {
      this.errorMessage = t('feedback.communities.breakingInvalid');
      return;
    }
    if (neutral && !isWaveHeatEvent(this.newRoundEventType)
      && performanceError(this.newRoundEventType, selectedEntries)) {
      this.errorMessage = t(this.newRoundEventType === 'TRAMPOLINE_INDIVIDUAL'
        ? 'feedback.communities.trampolineInvalid' : 'feedback.communities.performanceInvalid');
      return;
    }
    if (race) {
      const invalid = raceEntryValidationError(selectedEntries);
      if (invalid) {
        this.errorMessage = t('feedback.communities.' + invalid);
        return;
      }
    }

    const entries = selectedEntries
      .map(entry => ({
        username: entry.username,
        team: race || neutral ? null : (entry.team.trim() || null),
        result: breaking ? entry.result
          : race || neutral ? 'DRAW' as CommunityMatchResult
          : racket ? (entry.team === racketWinner ? 'WIN' : 'LOSS') as CommunityMatchResult
          : entry.result,
        goals: race || neutral || racket ? 0 : Math.max(0, Number(entry.goals) || 0),
        assists: race || neutral || racket ? 0 : Math.max(0, Number(entry.assists) || 0),
        mvp: !race && !neutral && !racket && Boolean(entry.mvp),
        cleanSheet: !race && !neutral && !racket && Boolean(entry.cleanSheet),
        ...(neutral && !isWaveHeatEvent(this.newRoundEventType)
          ? { performanceValue: entry.performanceValue ?? null } : {}),
        ...(neutral && isWaveHeatEvent(this.newRoundEventType)
          ? { waveScore1: entry.waveScore1 ?? null, waveScore2: entry.waveScore2 ?? null } : {}),
        ...(race ? {
          finishPosition: entry.finishPosition ?? null,
          elapsedSeconds: entry.elapsedSeconds ?? null,
          bestLapSeconds: this.raceSupportsLaps(this.newRoundSport) ? entry.bestLapSeconds ?? null : null,
          lapsCompleted: this.raceSupportsLaps(this.newRoundSport) ? entry.lapsCompleted ?? null : null
        } : {})
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
      sport: this.newRoundSport,
      eventType: this.newRoundEventType,
      eventDiscipline: this.roundDisciplineDraft || null,
      ...(racket ? { matchFormat: this.racketMatchFormat,
        setScores: this.racketSetScores.map(set => ({ ...set })) } : {}),
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
          this.roundEventTypeDraft = '';
          this.roundDisciplineDraft = '';
          this.racketMatchFormat = 'SINGLES';
          this.racketSetScores = [{sideA: null,sideB: null},{sideA: null,sideB: null}];
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

  shareWhatsAppGroup(): void {
    const community = this.selected;
    if (!community || !this.canManage()) {
      return;
    }

    const url = buildCommunityGroupInviteUrl(window.location.origin, community.id);
    const message = [
      t('communities.whatsappShareMessage', { name: community.name }),
      t(community.visibility === 'PRIVATE'
        ? 'communities.whatsappSharePrivate'
        : 'communities.whatsappSharePublic'),
      url
    ].join('\n\n');

    window.open(buildWhatsAppGroupShareUrl(message), '_blank', 'noopener,noreferrer');
  }

  async copyWhatsAppGroupLink(): Promise<void> {
    const community = this.selected;
    if (!community || !this.canManage()) {
      return;
    }

    this.groupInviteFeedback = '';
    const url = buildCommunityGroupInviteUrl(window.location.origin, community.id);
    try {
      await navigator.clipboard.writeText(url);
      this.groupInviteFeedback = t('communities.whatsappCopied');
    } catch {
      this.groupInviteFeedback = t('communities.whatsappCopyFailed');
    }
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
        // Switching through an invitation must not reuse another community's archives.
        this.communityOpenRequestVersion = (this.communityOpenRequestVersion || 0) + 1;
        this.invalidateArchiveRequests();
        this.competitionRequestVersion = (this.competitionRequestVersion || 0) + 1;
        this.communitySessionsRequestVersion = (this.communitySessionsRequestVersion || 0) + 1;
        this.selected = community;
        this.activeTab = 'home';
        this.pendingArchiveDeepLinkCommunityId = null;
        this.selectedSeasonId = null;
        this.competition = undefined;
        this.communitySessions = [];
        this.resetHistoricalLinks();
        this.archiveSummaries = [];
        this.matchArchiveSummaries = [];
        this.archiveOpen = undefined;
        this.matchArchiveOpen = undefined;
        this.archiveConfirmed = undefined;
        this.matchArchiveConfirmed = undefined;
        this.archivesError = '';
        this.matchArchivesError = '';
        this.prepareRoundEntries(community);
        this.loadArchivedStandings(community.id);
        this.loadMatchArchives(community.id);
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
        this.pendingArchiveDeepLinkCommunityId = null;
        this.resetHistoricalLinks();
        this.competition = undefined;
        this.maxStandingPoints = 0;
        this.topGoalsStanding = undefined;
        this.topAssistsStanding = undefined;
        this.topMvpsStanding = undefined;
        this.topCleanSheetsStanding = undefined;
        this.mostGamesStanding = undefined;
        this.bestWinRateStanding = undefined;
        this.bestWinStreakStanding = undefined;
        this.standingsByUsername.clear();
        this.activeCommunitySeason = undefined;
        this.communityTrophies = [];
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

    return this.sessionDateFormatter.format(new Date(parsed));
  }

  formatRoundDate(value: string): string {
    const parsed = Date.parse(value);
    if (Number.isNaN(parsed)) {
      return value;
    }

    return this.roundDateFormatter.format(new Date(parsed));
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
    return this.activeCommunitySeason;
  }

  trophies(): CommunitySeason[] {
    return this.communityTrophies;
  }

  mostGames(): CommunityStanding | undefined {
    return this.mostGamesStanding;
  }

  bestWinRate(): CommunityStanding | undefined {
    return this.bestWinRateStanding;
  }

  bestWinStreak(): CommunityStanding | undefined {
    return this.bestWinStreakStanding;
  }

  comparePlayerA(): CommunityStanding | undefined {
    return this.standingsByUsername.get(this.compareUsernameA);
  }

  comparePlayerB(): CommunityStanding | undefined {
    return this.standingsByUsername.get(this.compareUsernameB);
  }

  pointsBarWidth(row: CommunityStanding): number {
    if (this.maxStandingPoints <= 0) {
      return 0;
    }
    return Math.max(
      4,
      Math.round((row.points / this.maxStandingPoints) * 100)
    );
  }

  leader(): CommunityStanding | undefined {
    return this.competition?.standings[0];
  }

  topGoals(): CommunityStanding | undefined {
    return this.topGoalsStanding;
  }

  topAssists(): CommunityStanding | undefined {
    return this.topAssistsStanding;
  }

  topMvps(): CommunityStanding | undefined {
    return this.topMvpsStanding;
  }

  topCleanSheets(): CommunityStanding | undefined {
    return this.topCleanSheetsStanding;
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
