import { ChangeDetectorRef, Component, ElementRef, Input, OnChanges, SimpleChanges, ViewChild } from '@angular/core';
import { finalize, firstValueFrom, forkJoin, Observable, timeout } from 'rxjs';
import { CommunityGroup } from '../model/community-group';
import { HistoricalMatchArchive } from '../../services/community-groups.service';
import { historicalTournamentStandings, HistoricalTournamentStanding, canEstimateHistoricalLeagueStandings } from './community-historical-tournament-standings';
import { historicalTournamentOutcome, HistoricalTournamentOutcome } from './community-historical-tournament-outcome';
import { groupHistoricalTournamentSourceRows } from './community-historical-tournament-source-groups';
import { historicalKnockoutPhaseOverview, HistoricalKnockoutPhaseOverview, HistoricalKnockoutPhaseId } from './community-historical-knockout-overview';
import { historicalMatchReviewFlags } from './community-historical-match-review';
import {
  CommunityTournament, TournamentStatus, TournamentPointRules, TeamTieBreakPriority, TournamentMatch, TournamentParticipant, TournamentStandingRow,
  TournamentStandings, TournamentTeam, TournamentTeamMatch, TournamentTeamStandings, TournamentTeamGroups,
  TournamentRaceOverview, TournamentRaceStanding, TournamentRaceEntry,
  InlineSpeedOverview, InlineSpeedProposal, InlineSpeedSkater, InlineSpeedStage, InlineSpeedTieEvidenceType, InlineSpeedTrialRequest
} from '../model/community-tournament';
import { CommunityTournamentsService, isRaceChampionshipSport, RaceChampionshipSport } from '../../services/community-tournaments.service';
import { AuthenticationService } from '../../services/authethication.service';
import { tournamentScoreTerminology } from './community-tournament-scoring';
import { formatForSport } from './community-round-sport';
import { tournamentClassificationProfile } from './community-tournament-classification';
import { SPORTS_CATALOG } from '../../shared/sports-catalog';
import { appTranslate as t } from '../../i18n/i18n.service';
import { buildTournamentTeamInviteUrl, teamInvitationWhatsAppUrl } from './community-team-invite';
import { formatKartingDuration, kartingRaceAward, orderedKartingRaceEntries } from './community-karting-race-display';

@Component({
  selector: 'app-community-tournaments',
  templateUrl: './community-tournaments.component.html',
  styleUrls: ['./community-tournaments.component.css'],
  standalone: false
})
export class CommunityTournamentsComponent implements OnChanges {
  @Input({ required: true }) community!: CommunityGroup;
  @Input() invitedTournamentId: number | null = null;
  @Input() invitedTeamId: number | null = null;

  tournaments: CommunityTournament[] = [];
  selected?: CommunityTournament;
  historicalArchive?: HistoricalMatchArchive;
  historicalArchivePage = 0;
  /** Each phase advances independently across its explicitly flagged source rows. */
  historicalReviewCursor: Record<HistoricalKnockoutPhaseId, number> =
    { quarterfinal: -1, semifinal: -1, final: -1 };
  readonly historicalMatchReviewFlags = historicalMatchReviewFlags;
  @ViewChild('historicalArchiveFixtures') private historicalArchiveFixtures?: ElementRef<HTMLElement>;

  /** Source-labelled stages, without inventing a fixture, bracket or official rank. */
  get historicalKnockoutPhases() {
    return this.historicalArchive ? historicalKnockoutPhaseOverview(this.historicalArchive) : [];
  }

  /** Navigate to the original row page and reveal the existing fixture list. */
  showHistoricalKnockoutPhase(firstArchiveIndex: number): void {
    if (!this.historicalArchive || firstArchiveIndex < 0
      || firstArchiveIndex >= this.historicalArchive.rows.length) return;
    this.historicalArchivePage = Math.floor(firstArchiveIndex / 50);
    this.changeDetector.detectChanges();

    // A page can contain several source-defined stages. Jump to the actual
    // first original match, not just the archive heading or the first group.
    // Use the sourceRow from our own archived row; never build a selector from
    // user-entered phase names.
    const sourceRow = this.historicalArchive.rows[firstArchiveIndex].sourceRow;
    const section = this.historicalArchiveFixtures?.nativeElement;
    const match = section?.querySelector<HTMLElement>(
      `[data-historical-source-row="${sourceRow}"]`
    );
    (match ?? section)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /** Review only actual flagged rows; a stage-count mismatch is not a fixture. */
  showNextHistoricalReview(phase: HistoricalKnockoutPhaseOverview): void {
    const current = this.historicalKnockoutPhases.find(item => item.phase === phase.phase);
    const indices = current?.reviewArchiveIndices ?? [];
    if (!indices.length) return;
    const next = (this.historicalReviewCursor[phase.phase] + 1) % indices.length;
    this.historicalReviewCursor[phase.phase] = next;
    this.showHistoricalKnockoutPhase(indices[next]);
  }

  /** Contiguous labels exactly as found in the spreadsheet, within this page. */
  get historicalArchivePageGroups() {
    if (!this.historicalArchive) return [];
    const start = this.historicalArchivePage * 50;
    return groupHistoricalTournamentSourceRows(this.historicalArchive.rows.slice(start, start + 50));
  }

  get canEstimateHistoricalLeagueTable(): boolean {
    return this.selected?.format === 'LEAGUE'
      && canEstimateHistoricalLeagueStandings(this.selected.sport);
  }

  get historicalLeagueTable(): HistoricalTournamentStanding[] {
    if (!this.canEstimateHistoricalLeagueTable || !this.historicalArchive || !this.selected) return [];
    return historicalTournamentStandings(this.historicalArchive,
      this.selected.winPoints, this.selected.drawPoints, this.selected.lossPoints);
  }

  get historicalScoreLabels() {
    return tournamentScoreTerminology(this.selected?.sport);
  }

  get historicalOutcome(): HistoricalTournamentOutcome | null {
    if (!this.historicalArchive || !this.selected?.historicalArchiveId) return null;
    if (this.selected.format !== 'LEAGUE' && this.selected.format !== 'KNOCKOUT') return null;
    return historicalTournamentOutcome(
      this.historicalArchive, this.selected.format, this.selected.sport,
      this.selected.winPoints, this.selected.drawPoints, this.selected.lossPoints
    );
  }

  tournamentsPage = 0;
  tournamentsHasMore = false;
  participants: TournamentParticipant[] = [];
  participantsPage = 0;
  participantsHasMore = false;
  rosterReady = false;
  matches: TournamentMatch[] = [];
  matchesPage = 0;
  matchesHasMore = false;
  standings?: TournamentStandings;
  raceOverview?: TournamentRaceOverview;
  speedOverview?: InlineSpeedOverview;
  speedError = false;
  speedHeats: Record<number, number> = {};
  speedSelections: Record<string, number[]> = {};
  speedTieCorrectionOpen = false;
  speedReasons: Record<string, string> = {};
  speedEvidenceType: InlineSpeedTieEvidenceType | '' = '';
  speedEvidenceReference = '';
  speedTieTrialIds: number[] = [];
  speedTrialOrderExceptionReason = '';
  speedTrialOpen = false;
  speedTrialHeldAt = '';
  speedTrialReference = '';
  speedTrialReason = '';
  speedTrialPlaces: Record<number, number | null> = {};
  speedTrialTimes: Record<number, number | null> = {};
  private speedRevision = 0;
  raceError = false;
  racePointsDraft = '';
  private raceRevision = 0;

  showGuide = false;
  showIndividualCreate = false;
  showTeamCreate = false;
  roundRobinLegsDraft: 1 | 2 = 1;
  teamFormatDraft: 'LEAGUE' | 'KNOCKOUT' | 'GROUP_KNOCKOUT' = 'LEAGUE';
  teamGroupCountDraft: 2 | 4 = 2;
  teamTieBreakPriorityDraft: TeamTieBreakPriority = 'GOAL_DIFFERENCE_FIRST';
  winPointsDraft = 3;
  drawPointsDraft = 1;
  lossPointsDraft = 0;
  teamNameDraft = '';
  teamPlayerDraft: Record<number, number | null> = {};
  inviteCopyFeedback: Record<number, string> = {};
  teams: TournamentTeam[] = [];
  teamsLoadError = false;
  teamMatches: TournamentTeamMatch[] = [];
  teamMatchesPage = 0;
  teamMatchesHasMore = false;
  teamMatchesLoading = false;
  teamMatchesError = false;
  private teamMatchesRevision = 0;
  teamStandings?: TournamentTeamStandings;
  teamGroups?: TournamentTeamGroups;
  teamGroupsLoading = false;
  teamGroupsError = false;
  private teamGroupsRevision = 0;
  teamStandingsLoading = false;
  teamStandingsError = false;
  private teamStandingsRevision = 0;
  teamScoreDrafts: Record<number, { home: number | null; away: number | null }> = {};
  teamScoreTouched = new Set<number>();
  nameDraft = '';
  sportDraft = '';
  sportSearch = '';
  editingSport = false;
  get communitySportOptions(): string[] {
    const selected = this.community?.sports;
    return selected?.length ? selected : (this.community?.sport ? [this.community.sport] : []);
  }

  // Shortcut chips are only useful before the first selection. When changing a
  // sport, show search instead of implying the community sport is also selected.
  get showCommunitySportShortcuts(): boolean {
    return !this.sportDraft && this.communitySportOptions.length > 0;
  }

  /**
   * Tournament creation currently uses numeric head-to-head results.
   * Clearly distinguish that contract from the sport-specific formats
   * available when recording community rounds. Presentation only.
   */
  get creationSportNoticeKey(): string | null {
    if (!this.sportDraft.trim()) return null;
    if (this.sportDraft === 'Patinagem de Velocidade' && !this.showTeamCreate)
      return null;
    switch (formatForSport(this.sportDraft)) {
      case 'race':
        return 'communities.tournaments.creationRaceNotice';
      case 'measured':
      case 'judged':
      case 'score':
      case 'activity':
        return 'communities.tournaments.creationPerformanceNotice';
      case 'duel':
        return 'communities.tournaments.creationDuelNotice';
      case 'unknown':
        return 'communities.tournaments.creationUnknownNotice';
      default:
        return null;
    }
  }

  get suggestedSports(): string[] {
    const normalized = this.sportSearch.normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
    if (!normalized) return [];
    // Search the canonical catalog and the group's imported/legacy modalities.
    return [...new Set([...this.communitySportOptions, ...SPORTS_CATALOG])]
      .filter(item => item.normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '').toLowerCase().includes(normalized)).slice(0, 8);
  }

  chooseSport(sport: string): void {
    if (this.busy || !(SPORTS_CATALOG.includes(sport) || this.communitySportOptions.includes(sport))) return;
    if (this.sportDraft !== sport) {
      this.sportDraft = sport;
      this.resetPointRules();
    }
    this.sportSearch = '';
    this.editingSport = false;
  }

  toggleSportEditor(): void {
    if (this.busy || !this.sportDraft) return;
    this.editingSport = !this.editingSport;
    this.sportSearch = '';
  }

  loading = false;
  detailsLoading = false;
  busy = false;
  error = '';
  feedback = '';
  confirmAction: 'schedule' | 'complete' | 'completeTeam' | 'completeRace' | 'delete' | null = null;
  scoreDrafts: Record<number, { home: number | null; away: number | null }> = {};
  scoreTouched = new Set<number>();

  private focusErrorAfterRender = false;
  private focusPlayersAfterReload = false;

  // Angular 22 is zoneless; query setters focus controls when @if renders them.
  @ViewChild('errorNotice')
  set errorNotice(element: ElementRef<HTMLElement> | undefined) {
    if (element && this.focusErrorAfterRender) {
      this.focusErrorAfterRender = false;
      element.nativeElement.focus();
    }
  }

  @ViewChild('playersHeading')
  set playersHeading(element: ElementRef<HTMLElement> | undefined) {
    if (element && this.focusPlayersAfterReload) {
      this.focusPlayersAfterReload = false;
      element.nativeElement.focus();
    }
  }

  get teamTieBreakChoices(): ReadonlyArray<{
    value: TeamTieBreakPriority;
    title: string;
    explanation: string;
  }> {
    return [
      { value: 'GOAL_DIFFERENCE_FIRST', title: t('communities.tournaments.teamUi.tieDifference'),
        explanation: t('communities.tournaments.teamUi.tieDifferenceHelp') },
      { value: 'GOALS_SCORED_FIRST', title: t('communities.tournaments.teamUi.tieGoals'),
        explanation: t('communities.tournaments.teamUi.tieGoalsHelp') },
      { value: 'WINS_FIRST', title: t('communities.tournaments.teamUi.tieWins'),
        explanation: t('communities.tournaments.teamUi.tieWinsHelp') }
    ];
  }

  teamTieBreakLabel(priority: TeamTieBreakPriority | null | undefined): string {
    return this.teamTieBreakChoices.find(choice =>
      choice.value === (priority ?? 'GOAL_DIFFERENCE_FIRST'))?.title
      ?? t('communities.tournaments.teamUi.tieDifference');
  }

  get classificationProfile() {
    const profile = tournamentClassificationProfile(this.sportDraft);
    // Translate only display copy; keep all competition eligibility and scoring rules
    // from the shared, sport-aware classification profile unchanged.
    const family = profile.scoringMode === 'CHESS_HALF_POINTS' ? 'chess' : profile.format;
    const key = 'communities.tournaments.classificationUi.' + family + '.';
    return {
      ...profile,
      heading: t(key + 'heading'),
      detail: t(key + 'detail'),
      fields: t(key + 'fields')
    };
  }

  /** Generic position-based races only; subdisciplines require separate contracts. */
  get isRaceChampionshipDraft(): boolean {
    return !this.showTeamCreate && isRaceChampionshipSport(this.sportDraft);
  }

  raceSportLabel(sport: string | null | undefined): string {
    return sport === 'BMX' ? 'BMX Racing'
      : (sport || t('communities.tournaments.classificationUi.raceFallback'));
  }

  get isRaceCompetition(): boolean {
    return this.selected?.scoringMode === 'RACE_POINTS';
  }

  /** A speed-skating bracket uses timed heats, never generic league points. */
  get isInlineSpeedDraft(): boolean {
    return !this.showTeamCreate && this.sportDraft === 'Patinagem de Velocidade';
  }

  isInlineSpeedTournament(tournament: CommunityTournament | undefined): boolean {
    return tournament?.sport === 'Patinagem de Velocidade'
      && tournament.entryType !== 'TEAM'
      && tournament.scoringMode == null
      && !tournament.historicalArchiveId;
  }

  get isInlineSpeedCompetition(): boolean {
    return this.isInlineSpeedTournament(this.selected);
  }

  speedTournamentStatus(status: TournamentStatus): string {
    return t('communities.inlineSpeed.status.' + status);
  }

  speedStage(eventType: string): InlineSpeedStage {
    if (eventType.endsWith('_FIRST_ROUND')) return 'FIRST';
    if (eventType.endsWith('_QUARTER_HEAT')) return 'QUARTER';
    if (eventType.endsWith('_SEMI_HEAT')) return 'SEMI';
    return 'FINAL';
  }

  speedMaximumHeats(eventType: string): number {
    return { FIRST: 64, QUARTER: 4, SEMI: 2, FINAL: 1 }[this.speedStage(eventType)];
  }

  speedStageName(stage: InlineSpeedStage): string {
    return t('communities.inlineSpeed.stage.' + stage);
  }

  /** API warnings are authoritative but intentionally not locale-specific. */
  speedProposalWarning(proposal: InlineSpeedProposal): string {
    const warning = proposal.warning;
    if (warning.includes('Empate múltiplo'))
      return t('communities.inlineSpeed.warningMultipleTie');
    if (warning.includes('repetido')) return t('communities.inlineSpeed.warningDuplicate');
    if (warning.includes('tempos')) return t('communities.inlineSpeed.warningTimes');
    if (warning.includes('Posições')) return t('communities.inlineSpeed.warningPlaces');
    if (!proposal.ready) return t('communities.inlineSpeed.warningIncomplete');
    if (warning.includes('16.º/17.º') || proposal.playerIds.length > proposal.expectedCount)
      return t('communities.inlineSpeed.warningTie17');
    if (warning.includes('Empate')) return t('communities.inlineSpeed.warningTie');
    if (warning.includes('estrada')) return t('communities.inlineSpeed.warningRoad');
    return t('communities.inlineSpeed.warningPending');
  }

  speedStageSkaters(stage: InlineSpeedStage): InlineSpeedSkater[] {
    const athletes = new Map<number, InlineSpeedSkater>();
    for (const heat of this.speedOverview?.linkedHeats ?? []) {
      if (this.speedStage(heat.eventType) !== stage) continue;
      for (const skater of heat.skaters) athletes.set(skater.playerId, skater);
    }
    return [...athletes.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  speedTieBreak(stage: string) {
    return (this.speedOverview?.tieBreaks ?? []).find(item => item.sourceStage === stage);
  }

  /** Only real, still-current first-round trials may be cited by a new revision. */
  speedAvailableTieTrials() {
    return (this.speedOverview?.trials ?? []).filter(trial =>
      trial.sourceStage === 'FIRST' && !trial.stale)
      .sort((a, b) => a.heldAt.localeCompare(b.heldAt));
  }

  speedTrialLinked(id: number): boolean {
    return this.speedTieTrialIds.includes(id);
  }

  toggleSpeedTrialLink(id: number, checked: boolean): void {
    if (this.busy || !this.speedAvailableTieTrials().some(trial => trial.id === id)) return;
    if (checked) {
      if (!this.speedTieTrialIds.includes(id) && this.speedTieTrialIds.length < 10) {
        this.speedTieTrialIds = [...this.speedTieTrialIds, id];
      }
    } else {
      this.speedTieTrialIds = this.speedTieTrialIds.filter(value => value !== id);
    }
  }

  /** Comparisons are advisory: the jury may deliberately override finish order,
   * but the override needs a separately recorded explanation.
   */
  speedTrialOrderConflicts(): Array<{
    trialId: number; chosenId: number; chosenPlace: number;
    excludedId: number; excludedPlace: number
  }> {
    const selected = new Set(this.speedSelections['FIRST'] ?? []);
    const out: Array<{
      trialId: number; chosenId: number; chosenPlace: number;
      excludedId: number; excludedPlace: number
    }> = [];
    for (const trial of this.speedAvailableTieTrials()) {
      if (!this.speedTieTrialIds.includes(trial.id)) continue;
      for (const qualified of trial.results) {
        if (!selected.has(qualified.playerId)) continue;
        for (const unqualified of trial.results) {
          if (selected.has(unqualified.playerId) || unqualified.place >= qualified.place) continue;
          out.push({ trialId: trial.id, chosenId: qualified.playerId,
            chosenPlace: qualified.place, excludedId: unqualified.playerId,
            excludedPlace: unqualified.place });
        }
      }
    }
    return out;
  }

  speedTrialUsedRevisions(id: number): number[] {
    return (this.speedTieBreak('FIRST')?.revisions ?? [])
      .filter(revision => (revision.trialIds ?? []).includes(id))
      .map(revision => revision.revision);
  }

  speedEvidenceLabel(type: InlineSpeedTieEvidenceType | null | undefined): string {
    return type ? t('communities.inlineSpeed.evidence.' + type)
      : t('communities.inlineSpeed.evidence.legacy');
  }

  /** Keep the audit log readable with names, retaining IDs if a player was removed. */
  speedTieSkaterNames(ids: number[]): string {
    const names = new Map(this.speedStageSkaters('FIRST')
      .map(skater => [skater.playerId, skater.name]));
    return ids.map(id => names.get(id) ?? '#' + id).join(', ');
  }

  speedCanAmendTie(proposal: InlineSpeedProposal): boolean {
    return proposal.sourceStage === 'FIRST' && !!this.speedTieBreak('FIRST')
      && !this.speedDecision('FIRST') && this.canManage
      && this.selected?.status !== 'COMPLETED';
  }

  startSpeedTieCorrection(proposal: InlineSpeedProposal): void {
    if (this.busy || !this.speedCanAmendTie(proposal)) return;
    const ruling = this.speedTieBreak('FIRST');
    if (!ruling) return;
    this.speedSelections['FIRST'] = [...ruling.selectedPlayerIds];
    this.speedReasons['FIRST'] = ruling.reason;
    this.speedEvidenceType = ruling.evidenceType ?? '';
    this.speedEvidenceReference = ruling.evidenceReference ?? '';
    const available = new Set(this.speedAvailableTieTrials().map(trial => trial.id));
    this.speedTieTrialIds = (ruling.trialIds ?? []).filter(id => available.has(id));
    this.speedTrialOrderExceptionReason = ruling.trialOrderExceptionReason ?? '';
    this.speedTieCorrectionOpen = true;
  }

  /** Display only eligible cutoff candidates; never fabricate or edit recorded times. */
  isSpeedMultiwayTie(proposal: InlineSpeedProposal): boolean {
    return proposal.sourceStage === 'FIRST' && !proposal.ready
      && proposal.warning.includes('Empate múltiplo');
  }

  private speedTieOrdered(): InlineSpeedSkater[] {
    return this.speedStageSkaters('FIRST')
      .filter(s => !s.disqualified && s.seconds != null && s.seconds > 0)
      .sort((a, b) => (a.seconds ?? 0) - (b.seconds ?? 0) || a.playerId - b.playerId);
  }

  speedTieCandidates(): InlineSpeedSkater[] {
    const ordered = this.speedTieOrdered();
    if (ordered.length < 18) return [];
    const cutoff = ordered[15]?.seconds;
    return ordered.filter(s => s.seconds != null && cutoff != null && s.seconds <= cutoff);
  }

  /** Only the skaters actually tied on the qualification boundary may race a recorded trial. */
  speedTrialCandidates(): InlineSpeedSkater[] {
    return this.speedTieCandidates().filter(skater => !this.speedTieGuaranteed(skater));
  }

  openSpeedTrial(): void {
    const candidates = this.speedTrialCandidates();
    if (this.busy || !this.canManage || this.speedDecision('FIRST')
        || candidates.length < 3 || candidates.length > 6) return;
    this.speedTrialPlaces = {};
    this.speedTrialTimes = {};
    this.speedTrialHeldAt = '';
    this.speedTrialReference = '';
    this.speedTrialReason = '';
    this.speedTrialOpen = true;
  }

  async recordSpeedTrial(): Promise<void> {
    if (!this.selected || this.busy || !this.canManage || !this.speedTrialOpen
        || this.speedDecision('FIRST') || this.selected.status === 'COMPLETED') return;
    const candidates = this.speedTrialCandidates();
    if (candidates.length < 3 || candidates.length > 6) return;
    const places = candidates.map(s => Number(this.speedTrialPlaces[s.playerId]));
    const numericTimes = candidates.map(s => this.speedTrialTimes[s.playerId]);
    if (places.some(v => !Number.isInteger(v) || v < 1 || v > candidates.length)
        || new Set(places).size !== places.length
        || numericTimes.some(v => v != null && (!Number.isFinite(v) || v <= 0
             || !Number.isInteger(v * 1000)))) {
      this.showError(t('communities.inlineSpeed.trialInvalidPlaces'));
      return;
    }
    const date = new Date(this.speedTrialHeldAt);
    const reference = this.speedTrialReference.trim();
    const reason = this.speedTrialReason.trim();
    if (!this.speedTrialHeldAt || !Number.isFinite(date.getTime()) || date.getTime() > Date.now()
        || reference.length < 8 || reference.length > 500
        || reason.length < 20 || reason.length > 500) {
      this.showError(t('communities.inlineSpeed.trialRequired'));
      return;
    }
    const request: InlineSpeedTrialRequest = {
      actuallyHeld: true,
      heldAt: date.toISOString(),
      officialReference: reference,
      reason,
      results: candidates.map((skater, index) => ({
        playerId: skater.playerId, place: places[index], seconds: numericTimes[index] ?? null
      }))
    };
    await this.mutate(this.api.recordInlineSpeedTrial(this.community.id, this.selected.id, request),
      t('communities.inlineSpeed.trialSaved'), overview => {
        this.speedOverview = overview;
        this.speedTrialOpen = false;
        this.loadInlineSpeed();
      });
  }

  speedTieGuaranteed(skater: InlineSpeedSkater): boolean {
    const cutoff = this.speedTieOrdered()[15]?.seconds;
    return skater.seconds != null && cutoff != null && skater.seconds < cutoff;
  }

  private speedTieDefaultIds(): number[] {
    return this.speedTieCandidates()
      .filter(s => this.speedTieGuaranteed(s)).map(s => s.playerId);
  }

  async resolveSpeedTie(proposal: InlineSpeedProposal): Promise<void> {
    if (!this.selected || !this.canManage || this.busy
        || !(this.isSpeedMultiwayTie(proposal)
          || (this.speedTieCorrectionOpen && this.speedCanAmendTie(proposal)))) return;
    const chosen = this.speedSelections['FIRST'] ?? [];
    const reason = (this.speedReasons['FIRST'] ?? '').trim();
    if (chosen.length !== 16 || new Set(chosen).size !== 16) {
      this.showError(t('communities.inlineSpeed.tiebreakSelectionCount'));
      return;
    }
    if (reason.length < 20 || reason.length > 500) {
      this.showError(t('communities.inlineSpeed.tiebreakReasonRequired'));
      return;
    }
    const evidenceType = this.speedEvidenceType;
    const evidenceReference = this.speedEvidenceReference.trim();
    if (!evidenceType || evidenceReference.length < 8 || evidenceReference.length > 500) {
      this.showError(t('communities.inlineSpeed.evidenceRequired'));
      return;
    }
    const availableIds = new Set(this.speedAvailableTieTrials().map(trial => trial.id));
    if (this.speedTieTrialIds.length > 10
        || new Set(this.speedTieTrialIds).size !== this.speedTieTrialIds.length
        || this.speedTieTrialIds.some(id => !availableIds.has(id))
        || (evidenceType === 'TIEBREAK_TRIAL' && !this.speedTieTrialIds.length)) {
      this.showError(t('communities.inlineSpeed.trialLinkRequired'));
      return;
    }
    const conflicts = this.speedTrialOrderConflicts();
    const trialExceptionReason = conflicts.length
      ? this.speedTrialOrderExceptionReason.trim() : '';
    if (conflicts.length && (trialExceptionReason.length < 20
        || trialExceptionReason.length > 500)) {
      this.showError(t('communities.inlineSpeed.trialOrderExceptionRequired'));
      return;
    }
    await this.mutate(this.api.resolveInlineSpeedTieBreak(
      this.community.id, this.selected.id, chosen, reason, evidenceType,
      evidenceReference, [...this.speedTieTrialIds], trialExceptionReason),
      t('communities.inlineSpeed.tiebreakSaved'), overview => {
        this.speedOverview = overview;
        this.speedTieCorrectionOpen = false;
        this.loadInlineSpeed();
      });
  }

  speedChosen(stage: string, playerId: number): boolean {
    return (this.speedSelections[stage] ?? []).includes(playerId);
  }

  toggleSpeedChosen(stage: InlineSpeedStage, playerId: number): void {
    // Jury cannot approve an athlete marked DQ unless the original result
    // itself was officially corrected. Never toggle them in this panel.
    if (this.speedStageSkaters(stage).some(s => s.playerId === playerId && s.disqualified))
      return;
    if (stage === 'FIRST' && this.speedOverview?.proposals.some(
      p => this.isSpeedMultiwayTie(p) || this.speedTieCorrectionOpen) && this.speedTieCandidates().some(
      s => s.playerId === playerId && this.speedTieGuaranteed(s))) return;
    const previous = this.speedSelections[stage] ?? [];
    this.speedSelections[stage] = previous.includes(playerId)
      ? previous.filter(id => id !== playerId) : [...previous, playerId];
  }

  speedDecision(stage: string) {
    return this.speedOverview?.decisions.find(decision => decision.sourceStage === stage);
  }

  loadInlineSpeed(): void {
    const tournament = this.selected;
    if (!tournament || !this.isMember || this.detailsLoading) return;
    const communityId = this.community.id, revision = ++this.speedRevision;
    this.detailsLoading = true;
    this.speedError = false;
    this.api.inlineSpeedOverview(communityId, tournament.id).pipe(
      timeout(12000),
      finalize(() => {
        if (revision === this.speedRevision) {
          this.detailsLoading = false;
          this.changeDetector.markForCheck();
        }
      })
    ).subscribe({
      next: response => {
        if (revision !== this.speedRevision || this.community.id !== communityId
            || this.selected?.id !== tournament.id) return;
        this.speedOverview = response;
        for (const heat of response.availableHeats)
          this.speedHeats[heat.roundId] ??= 1;
        this.speedSelections = {};
        for (const proposal of response.proposals) {
          this.speedSelections[proposal.sourceStage] =
            [...(response.decisions.find(item => item.sourceStage === proposal.sourceStage)
              ?.playerIds ?? (this.isSpeedMultiwayTie(proposal)
                ? this.speedTieDefaultIds() : proposal.playerIds))];
        }
        this.changeDetector.markForCheck();
      },
      error: () => {
        if (revision === this.speedRevision && this.selected?.id === tournament.id) {
          this.speedError = true;
          this.showError(t('communities.inlineSpeed.loadError'));
        }
      }
    });
  }

  async linkSpeedHeat(roundId: number): Promise<void> {
    if (!this.selected || !this.canManage || this.busy) return;
    const number = this.speedHeats[roundId] ?? 1;
    if (!Number.isInteger(number) || number < 1 || number > 64) {
      this.showError(t('communities.inlineSpeed.invalidHeat')); return;
    }
    await this.mutate(this.api.linkInlineSpeedHeat(this.community.id, this.selected.id, roundId, number),
      t('communities.inlineSpeed.linked'), overview => {
        this.speedOverview = overview;
        this.updateSelected({ ...this.selected!, status: 'IN_PROGRESS' });
        this.loadInlineSpeed();
      });
  }

  async unlinkSpeedHeat(roundId: number): Promise<void> {
    if (!this.selected || !this.canManage || this.busy) return;
    await this.mutate(this.api.unlinkInlineSpeedHeat(this.community.id, this.selected.id, roundId),
      t('communities.inlineSpeed.unlinked'), overview => {
        this.speedOverview = overview;
        if (!overview.linkedHeats.length)
          this.updateSelected({ ...this.selected!, status: 'DRAFT', startedAt: null });
        this.loadInlineSpeed();
      });
  }

  async confirmSpeedStage(proposal: InlineSpeedProposal): Promise<void> {
    if (!this.selected || !this.canManage || this.busy || !proposal.ready) return;
    const ids = this.speedSelections[proposal.sourceStage] ?? [];
    if (!ids.length || new Set(ids).size !== ids.length) {
      this.showError(t('communities.inlineSpeed.noSelection')); return;
    }
    const reason = this.speedReasons[proposal.sourceStage] ?? '';
    const selectable = this.speedStageSkaters(proposal.sourceStage)
      .filter(s => !s.disqualified).map(s => s.playerId);
    if (ids.some(id => !selectable.includes(id))) {
      this.showError(t('communities.inlineSpeed.dqNotSelectable'));
      return;
    }
    const extraWithoutTie = proposal.sourceStage === 'FIRST'
      && proposal.targetStage === 'QUARTER' && proposal.expectedCount === 16
      && proposal.playerIds.length === 16 && ids.length === 17;
    if (extraWithoutTie && reason.trim().length < 20) {
      this.showError(t('communities.inlineSpeed.exceptionReasonRequired'));
      return;
    }
    await this.mutate(this.api.confirmInlineSpeedQualification(this.community.id, this.selected.id,
      proposal.sourceStage, ids, reason), t('communities.inlineSpeed.confirmed'), overview => {
      this.speedOverview = overview;
      this.loadInlineSpeed();
    });
  }

  /** Completed championships using the validated race-result formats. */
  get kartingPalmares(): CommunityTournament[] {
    return this.tournaments
      .filter(tournament => tournament.scoringMode === 'RACE_POINTS'
        && tournament.status === 'COMPLETED')
      .sort((a, b) => (Date.parse(b.completedAt ?? '') || 0)
        - (Date.parse(a.completedAt ?? '') || 0));
  }

  /** The archived positions decide the medals, not the UI order or points alone. */
  get finalKartingPodium(): TournamentRaceStanding[] {
    if (!this.isRaceCompetition || this.selected?.status !== 'COMPLETED') return [];
    return (this.raceOverview?.standings ?? [])
      .filter(driver => Number.isInteger(driver.position)
        && driver.position >= 1 && driver.position <= 3)
      .sort((a, b) => a.position - b.position || a.playerId - b.playerId);
  }

  get hasKartingCompetitions(): boolean {
    return this.tournaments.some(tournament => tournament.scoringMode === 'RACE_POINTS');
  }

  hasRaceLaps(entries: readonly TournamentRaceEntry[]): boolean {
    return entries.some(entry => entry.lapsCompleted != null);
  }

  hasRaceBestLap(entries: readonly TournamentRaceEntry[]): boolean {
    return entries.some(entry => entry.bestLapSeconds != null);
  }

  orderedKartingRaceEntries(entries: readonly TournamentRaceEntry[]): TournamentRaceEntry[] {
    return orderedKartingRaceEntries(entries);
  }

  formatKartingDuration(seconds: number | null | undefined): string {
    return formatKartingDuration(seconds);
  }

  kartingRaceAward(entry: TournamentRaceEntry): number {
    return kartingRaceAward(entry, this.raceOverview?.pointsByPlace ?? []);
  }

  get isSportFormatSupported(): boolean {
    return (!this.showTeamCreate && this.sportDraft === 'Patinagem de Velocidade')
      || this.isRaceChampionshipDraft || this.classificationProfile.isRoundRobinSupported
      && !(this.showTeamCreate && this.classificationProfile.scoringMode === 'CHESS_HALF_POINTS');
  }

  get sportFormatWarning(): string {
    if (!this.showTeamCreate && this.sportDraft === 'Patinagem de Velocidade')
      return t('communities.inlineSpeed.creationHelp');
    if (this.isRaceChampionshipDraft) {
      if (this.sportDraft === 'BMX') return t('communities.race.bmxRacingOnly');
      if (this.sportDraft === 'Ciclismo de Estrada') return t('communities.roadCycling.championshipNotice');
      if (this.sportDraft === 'Ciclismo de Pista') return t('communities.trackCycling.championshipNotice');
      if (this.sportDraft === 'Ciclismo' || this.sportDraft === 'Mountain Bike'
          || this.sportDraft === 'Ciclocrosse') {
        return t('communities.race.communityScoring');
      }
      return t('communities.karting.creationHint');
    }
    return this.showTeamCreate && this.classificationProfile.scoringMode === 'CHESS_HALF_POINTS'
      ? t('communities.tournaments.organizerUi.teamChessUnavailable')
      : this.classificationProfile.detail;
  }

  get isChessTournament(): boolean {
    return this.selected?.scoringMode === 'CHESS_HALF_POINTS';
  }

  formatTournamentPoints(points: number | null | undefined): string {
    if (points == null) return '—';
    return this.isChessTournament ? (points / 2).toLocaleString('pt-PT') : String(points);
  }

  chessOutcome(match: TournamentMatch): string {
    const score = this.scoreDraft(match);
    if (score.home === 1 && score.away === 0) return 'WHITE';
    if (score.home === 0 && score.away === 0) return 'DRAW';
    if (score.home === 0 && score.away === 1) return 'BLACK';
    return '';
  }

  displayTournamentResult(match: TournamentMatch): string {
    if (this.isChessTournament) {
      if (match.homeScore === 1 && match.awayScore === 0) return '1 – 0';
      if (match.homeScore === 0 && match.awayScore === 0) return '½ – ½';
      if (match.homeScore === 0 && match.awayScore === 1) return '0 – 1';
      return '—';
    }
    return match.homeScore + ' : ' + match.awayScore;
  }

  setChessOutcome(match: TournamentMatch, outcome: string): void {
    const mapped = outcome === 'WHITE' ? { home: 1, away: 0 }
      : outcome === 'DRAW' ? { home: 0, away: 0 }
      : outcome === 'BLACK' ? { home: 0, away: 1 }
      : { home: null, away: null };
    this.scoreDrafts[match.id] = mapped;
    this.scoreTouched.add(match.id);
  }

  validTournamentScore(match: TournamentMatch): boolean {
    const score = this.scoreDraft(match);
    if (!this.validScore(score.home) || !this.validScore(score.away)) return false;
    return !this.isChessTournament
      || ((score.home === 1 && score.away === 0)
          || (score.home === 0 && score.away === 0)
          || (score.home === 0 && score.away === 1));
  }

  get pointRulesDraft(): TournamentPointRules {
    return {
      winPoints: this.winPointsDraft,
      drawPoints: this.drawPointsDraft,
      lossPoints: this.lossPointsDraft
    };
  }

  get validPointRules(): boolean {
    return Object.values(this.pointRulesDraft)
      .every(value => Number.isInteger(value) && value >= 0 && value <= 100)
      && (!this.classificationProfile.readOnlyPoints
        || this.classificationProfile.scoringMode !== 'CHESS_HALF_POINTS'
        || (this.winPointsDraft === 2 && this.drawPointsDraft === 1 && this.lossPointsDraft === 0));
  }

  private resetPointRules(): void {
    const points = tournamentClassificationProfile(this.sportDraft).pointRules;
    this.winPointsDraft = points.winPoints;
    this.drawPointsDraft = points.drawPoints;
    this.lossPointsDraft = points.lossPoints;
  }

  get nameTooShort(): boolean {
    const len = this.nameDraft.trim().length;
    return len > 0 && len < 2;
  }

  isScoreInvalid(match: TournamentMatch): boolean {
    const score = this.scoreDraft(match);
    return this.scoreTouched.has(match.id)
      && !this.validTournamentScore(match);
  }

  private showError(message: string): void {
    this.error = message;
    this.focusErrorAfterRender = true;
    this.changeDetector.markForCheck();
  }

  private refreshRosterAndFocus(): void {
    this.focusPlayersAfterReload = true;
    this.loadDetails();
  }

  private listRevision = 0;
  private detailRevision = 0;
  private mutationRevision = 0;
  private standingsRevision = 0;

  constructor(
    private readonly api: CommunityTournamentsService,
    private readonly authentication: AuthenticationService,
    private readonly changeDetector: ChangeDetectorRef
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['community'] && this.community?.id) {
      ++this.listRevision;
      ++this.detailRevision;
      ++this.mutationRevision;
      ++this.standingsRevision;
      ++this.raceRevision;
      this.raceOverview = undefined;
      this.raceError = false;
      ++this.teamMatchesRevision;
      ++this.teamStandingsRevision;
      ++this.teamGroupsRevision;
      this.busy = false;
      this.showGuide = false;
      this.showIndividualCreate = false;
      this.showTeamCreate = false;
      this.roundRobinLegsDraft = 1;
      this.teamFormatDraft = 'LEAGUE';
      this.teamGroupCountDraft = 2;
      this.teamTieBreakPriorityDraft = 'GOAL_DIFFERENCE_FIRST';
      this.resetPointRules();
      this.teamNameDraft = '';
      this.teamPlayerDraft = {};
      this.inviteCopyFeedback = {};
      this.teams = [];
      this.teamsLoadError = false;
      this.teamMatches = [];
      this.teamMatchesHasMore = false;
      this.teamMatchesLoading = false;
      this.teamMatchesError = false;
      this.teamStandings = undefined;
      this.teamGroups = undefined;
      this.teamGroupsLoading = false;
      this.teamGroupsError = false;
      this.teamStandingsLoading = false;
      this.teamStandingsError = false;
      this.teamScoreDrafts = {};
      this.teamScoreTouched.clear();
      // A sole community sport is convenient; multi-sport requires an explicit choice.
      const sports = this.community.sports;
      this.sportDraft = sports?.length === 1
        ? sports[0] : (!sports?.length ? this.community.sport || '' : '');
      this.sportSearch = '';
      this.editingSport = false;
      this.resetPointRules();
      this.selected = undefined;
      this.loading = false;
      this.detailsLoading = false;
      this.tournaments = [];
      this.participants = [];
      this.rosterReady = false;
      this.matches = [];
      this.standings = undefined;
      this.error = '';
      this.feedback = '';
      this.confirmAction = null;
      this.focusErrorAfterRender = false;
      this.focusPlayersAfterReload = false;
      this.scoreTouched.clear();
      this.loadTournaments(true);
    }
  }

  get canManage(): boolean {
    return this.community?.myRole === 'OWNER' || this.community?.myRole === 'ADMIN';
  }

  get isMember(): boolean {
    return this.community?.myRole === 'OWNER'
      || this.community?.myRole === 'ADMIN'
      || this.community?.myRole === 'MEMBER';
  }

  get myUsername(): string {
    if (!this.authentication.loggedInPerfilname) {
      this.authentication.isLoggedIn();
    }
    return (this.authentication.loggedInPerfilname || '').toLowerCase();
  }

  get myEnrollment(): TournamentParticipant | undefined {
    return this.participants.find(p => p.username.toLowerCase() === this.myUsername);
  }

  get scoring() {
    const terminology = tournamentScoreTerminology(
      this.selected?.entryType === 'TEAM' ? null : this.selected?.sport
    );
    const kind = terminology.forTitle === 'Golos marcados' ? 'goals'
      : terminology.forTitle === 'Pontos marcados' ? 'points'
      : terminology.forTitle === 'Sets ganhos' ? 'sets' : 'generic';
    const translated = (field: string) =>
      t('communities.tournaments.individualUi.scoring.' + kind + '.' + field);
    return {
      ...terminology,
      scoreInput: translated('scoreInput'),
      forTitle: translated('forTitle'),
      againstTitle: translated('againstTitle'),
      differenceTitle: translated('differenceTitle'),
      forAbbrev: translated('forAbbrev'),
      againstAbbrev: translated('againstAbbrev'),
      differenceAbbrev: translated('differenceAbbrev'),
      note: translated('note')
    };
  }

  get isTeamCompetition(): boolean {
    return this.selected?.entryType === 'TEAM';
  }

  get availableTeamMembers() {
    const assigned = new Set(this.teams.flatMap(team => team.players.map(player => player.profileId)));
    return (this.community.members || []).filter(member => !assigned.has(member.profileId));
  }

  get invitedTeam(): TournamentTeam | undefined {
    if (!this.invitedTeamId || this.selected?.id !== this.invitedTournamentId) return undefined;
    return this.teams.find(team => team.id === this.invitedTeamId);
  }

  get myTeam(): TournamentTeam | undefined {
    return this.teams.find(team => team.players.some(player =>
      player.username.toLowerCase() === this.myUsername));
  }

  teamInviteUrl(team: TournamentTeam): string {
    if (!this.selected || !this.community?.id) return '';
    return buildTournamentTeamInviteUrl(
      window.location.origin, this.community.id, this.selected.id, team.id);
  }

  teamWhatsAppUrl(team: TournamentTeam): string {
    if (!this.selected) return '';
    return teamInvitationWhatsAppUrl(
      this.community.name, this.selected.name, team.name, this.teamInviteUrl(team));
  }

  async copyTeamInvite(team: TournamentTeam): Promise<void> {
    if (!this.canManageTeamRoster || this.isTeamRosterFull(team)) return;
    try {
      await navigator.clipboard.writeText(this.teamInviteUrl(team));
      this.inviteCopyFeedback[team.id] = t('communities.tournaments.teamUi.copySuccess');
    } catch {
      this.inviteCopyFeedback[team.id] = t('communities.tournaments.teamUi.copyError');
    }
    this.changeDetector.markForCheck();
  }

  async acceptInvitedTeam(): Promise<void> {
    const team = this.invitedTeam;
    if (!team || !this.selected || !this.isMember || this.busy || this.detailsLoading
        || this.selected.status !== 'DRAFT' || this.myTeam
        || this.isTeamRosterFull(team)) return;
    await this.mutate(
      this.api.acceptTeamInvite(this.community.id, this.selected.id, team.id),
      t('communities.tournaments.teamUi.acceptSuccess', {team: team.name}),
      () => this.loadTeams()
    );
  }

  get isKnockout(): boolean {
    return this.isTeamCompetition && this.selected?.format === 'KNOCKOUT';
  }

  get isGroupKnockout(): boolean {
    return this.isTeamCompetition && this.selected?.format === 'GROUP_KNOCKOUT';
  }

  get isCupFormat(): boolean {
    return this.isKnockout || this.isGroupKnockout;
  }

  isEliminationMatch(game: TournamentTeamMatch): boolean {
    return this.isKnockout || (this.isGroupKnockout && game.groupNumber == null);
  }

  groupLabel(number: number): string {
    return String.fromCharCode(64 + number);
  }

  teamMatchStageLabel(game: TournamentTeamMatch): string {
    if (!this.isGroupKnockout) {
      return t(this.isKnockout
        ? 'communities.tournaments.stageUi.knockoutRound'
        : 'communities.tournaments.stageUi.leagueRound', { round: game.roundNumber });
    }
    if (game.groupNumber != null) {
      return t('communities.tournaments.stageUi.groupRound', {
        group: this.groupLabel(game.groupNumber), round: game.roundNumber
      });
    }
    const totalRounds = this.selected?.groupCount === 4 ? 3 : 2;
    const remaining = totalRounds - game.roundNumber;
    return remaining === 2 ? t('communities.tournaments.stageUi.quarterFinal')
      : remaining === 1 ? t('communities.tournaments.stageUi.semiFinal')
      : remaining === 0 ? t('communities.tournaments.stageUi.final')
      : t('communities.tournaments.stageUi.knockoutFallback', { round: game.roundNumber });
  }

  get knockoutTotalRounds(): number {
    return this.isGroupKnockout
      ? (this.selected?.groupCount === 4 ? 3 : 2)
      : (this.teams.length >= 2 ? Math.ceil(Math.log2(this.teams.length)) : 0);
  }

  get currentKnockoutRound(): number {
    return this.teamMatches.filter(game => this.isEliminationMatch(game))
      .reduce((latest, game) => Math.max(latest, game.roundNumber), 1);
  }

  isPastKnockoutRound(match: TournamentTeamMatch): boolean {
    return this.isEliminationMatch(match) && match.roundNumber < this.currentKnockoutRound;
  }

  get knockoutFirstRoundByes(): TournamentTeam[] {
    if (!this.isKnockout || !this.teamMatches.length) return [];
    const competing = new Set(this.teamMatches.filter(game => game.roundNumber === 1)
      .flatMap(game => [game.homeTeamId, game.awayTeamId]));
    return this.teams.filter(team => !competing.has(team.id));
  }

  get canManageTeamRoster(): boolean {
    return this.canManage && this.isTeamCompetition && this.selected?.status === 'DRAFT' && !this.busy;
  }

  // Existing tournaments retain their exact roster size. New tournaments with
  // no preset size can start once each team has at least one member.
  isTeamRosterReady(team: TournamentTeam): boolean {
    return team.playersPerTeam == null
      ? team.players.length >= 1 && team.players.length <= 30
      : team.players.length === team.playersPerTeam;
  }

  isTeamRosterFull(team: TournamentTeam): boolean {
    return team.players.length >= (team.playersPerTeam ?? 30);
  }

  get readyTeamCount(): number {
    return this.teams.filter(team => this.isTeamRosterReady(team)).length;
  }

  get canPublishTeamSchedule(): boolean {
    return this.canManageTeamRoster && !this.detailsLoading && !this.teamsLoadError
      && this.teams.length >= (this.isGroupKnockout ? (this.selected?.groupCount ?? 2) * 2 : 2)
      && this.teams.length <= 32
      && this.readyTeamCount === this.teams.length;
  }

  get canCompleteTeam(): boolean {
    const table = this.teamStandings;
    if (!table || !this.canManage || this.selected?.entryType !== 'TEAM'
        || this.selected.format !== 'LEAGUE'
        || this.selected.status !== 'IN_PROGRESS' || this.teamStandingsLoading
        || this.teamStandingsError || this.busy) return false;
    const size = table.standings.length;
    const expected = size * (size - 1) / 2 * (this.selected.roundRobinLegs ?? 1);
    return size >= 2 && size <= 32
      && table.totalMatches === expected && table.completedMatches === expected
      && table.standings.every(row => row.played === (size - 1) * (this.selected?.roundRobinLegs ?? 1));
  }

  get confirmedCount(): number {
    return this.participants.filter(p => p.status === 'CONFIRMED').length;
  }

  get canPublishSchedule(): boolean {
    return this.canManage && this.selected?.status === 'DRAFT'
      && this.rosterReady && !this.detailsLoading && !this.busy
      && !this.participantsHasMore
      && this.confirmedCount >= 2 && this.confirmedCount <= 32;
  }

  get canComplete(): boolean {
    if (this.selected?.status !== 'IN_PROGRESS' || !this.isMember || !this.standings) {
      return false;
    }
    const players = this.standings.standings.length;
    const expected = players * (players - 1) / 2;
    return players >= 2 && players <= 32
      && this.standings.totalMatches === expected
      && this.standings.completedMatches === expected
      && this.standings.standings.every(row => row.played === players - 1);
  }

  loadTournaments(reset = false): void {
    if (!this.community?.id || this.loading) return;
    const communityId = this.community.id;
    const revision = ++this.listRevision;
    const page = reset ? 0 : this.tournamentsPage + 1;
    this.loading = true;
    this.error = '';
    this.api.list(communityId, page).pipe(
      timeout(12000),
      finalize(() => {
        if (revision === this.listRevision) {
          this.loading = false;
          this.changeDetector.markForCheck();
        }
      })
    ).subscribe({
      next: result => {
        if (revision !== this.listRevision || this.community.id !== communityId) return;
        this.tournaments = reset ? result.tournaments : [...this.tournaments, ...result.tournaments];
        this.tournamentsPage = page;
        this.tournamentsHasMore = result.hasMore;
        if (reset && !result.tournaments.length && !this.showIndividualCreate && !this.showTeamCreate) this.showGuide = true;
        if (reset && !this.selected && this.invitedTournamentId) {
          const invited = result.tournaments.find(item => item.id === this.invitedTournamentId);
          if (invited) {
            this.selectTournament(invited);
          } else {
            // Older tournaments may be on later pages. Fetch the exact scoped ID,
            // rather than silently opening an unrelated competition.
            this.api.details(communityId, this.invitedTournamentId)
              .pipe(timeout(12000)).subscribe({
                next: detail => {
                  if (revision !== this.listRevision || this.community.id !== communityId
                      || this.selected) return;
                  this.selectTournament(detail);
                },
                error: () => {
                  if (revision === this.listRevision) {
                    this.showError(t('communities.tournaments.organizerUi.inviteExpired'));
                  }
                }
              });
          }
        } else if (reset && !this.selected && result.tournaments.length) {
          this.selectTournament(result.tournaments[0]);
        }
      },
      error: () => {
        if (revision === this.listRevision) this.showError(t('communities.tournaments.organizerUi.listError'));
      }
    });
  }

  selectTournament(tournament: CommunityTournament): void {
    if (this.selected?.id === tournament.id && !this.error) return;
    ++this.detailRevision;
    ++this.mutationRevision;
    ++this.standingsRevision;
    ++this.raceRevision;
    this.raceOverview = undefined;
    this.raceError = false;
    ++this.teamMatchesRevision;
    ++this.teamStandingsRevision;
    ++this.teamGroupsRevision;
    // A request for the previous tournament must not leave this one disabled.
    this.busy = false;
    this.detailsLoading = false;
    this.selected = tournament;
    ++this.speedRevision;
    this.speedOverview = undefined;
    this.speedError = false;
    this.speedSelections = {};
    this.speedTieCorrectionOpen = false;
    this.speedEvidenceType = '';
    this.speedEvidenceReference = '';
    this.speedTieTrialIds = [];
    this.speedTrialOrderExceptionReason = '';
    this.speedTrialOpen = false;
    this.speedTrialHeldAt = '';
    this.speedTrialReference = '';
    this.speedTrialReason = '';
    this.speedTrialPlaces = {};
    this.speedTrialTimes = {};
    this.historicalArchive = undefined;
    this.historicalArchivePage = 0;
    this.historicalReviewCursor = { quarterfinal: -1, semifinal: -1, final: -1 };
    this.confirmAction = null;
    this.feedback = '';
    this.error = '';
    this.participantsPage = 0;
    this.matchesPage = 0;
    this.participants = [];
    this.rosterReady = false;
    this.matches = [];
    this.standings = undefined;
    this.teams = [];
    this.teamPlayerDraft = {};
    this.teamsLoadError = false;
    this.teamMatches = [];
    this.teamMatchesHasMore = false;
    this.teamMatchesLoading = false;
    this.teamMatchesError = false;
    this.teamStandings = undefined;
    this.teamGroups = undefined;
    this.teamGroupsLoading = false;
    this.teamGroupsError = false;
    this.teamStandingsLoading = false;
    this.teamStandingsError = false;
    this.teamScoreDrafts = {};
    this.teamScoreTouched.clear();
    this.scoreDrafts = {};
    this.scoreTouched.clear();
    this.focusPlayersAfterReload = false;
    if (this.isMember) {
      this.loadDetails();
    }
  }

  loadDetails(): void {
    const tournament = this.selected;
    if (!tournament || !this.isMember || this.detailsLoading) return;
    if (tournament.historicalArchiveId) {
      this.loadHistoricalTournament(tournament);
      return;
    }
    if (tournament.entryType === 'TEAM') {
      this.loadTeams();
      return;
    }
    if (this.isInlineSpeedCompetition) {
      this.loadInlineSpeed();
      return;
    }
    if (tournament.scoringMode === 'RACE_POINTS') {
      this.loadRaceOverview();
      return;
    }
    const communityId = this.community.id;
    const revision = ++this.detailRevision;
    ++this.standingsRevision;
    this.detailsLoading = true;
    this.rosterReady = false;
    this.error = '';
    forkJoin({
      members: this.api.participants(communityId, tournament.id, 0),
      games: this.api.matches(communityId, tournament.id, 0),
      table: this.api.standings(communityId, tournament.id)
    }).pipe(
      timeout(12000),
      finalize(() => {
        if (revision === this.detailRevision) {
          this.detailsLoading = false;
          this.changeDetector.markForCheck();
        }
      })
    ).subscribe({
      next: ({ members, games, table }) => {
        if (revision !== this.detailRevision || this.community.id !== communityId
            || this.selected?.id !== tournament.id) return;
        this.participants = members.participants;
        this.rosterReady = true;
        this.participantsPage = 0;
        this.participantsHasMore = members.hasMore;
        this.matches = games.matches;
        this.matchesPage = 0;
        this.matchesHasMore = games.hasMore;
        this.standings = table;
        this.updateDraftScores(games.matches);
      },
      error: () => {
        if (revision === this.detailRevision) {
          this.focusPlayersAfterReload = false;
          this.showError(t('communities.tournaments.organizerUi.detailsError'));
        }
      }
    });
  }

  loadHistoricalTournament(tournament: CommunityTournament): void {
    if (!tournament.historicalArchiveId || !this.isMember || this.detailsLoading) return;
    const cid = this.community.id;
    const revision = ++this.detailRevision;
    this.detailsLoading = true;
    this.error = '';
    this.api.historicalArchive(cid, tournament.historicalArchiveId).pipe(
      timeout(12000),
      finalize(() => {
        if (revision === this.detailRevision) {
          this.detailsLoading = false;
          this.changeDetector.markForCheck();
        }
      })
    ).subscribe({
      next: archive => {
        if (revision !== this.detailRevision || this.community.id !== cid
            || this.selected?.id !== tournament.id) return;
        this.historicalArchive = archive;
        this.historicalArchivePage = 0;
        this.historicalReviewCursor = { quarterfinal: -1, semifinal: -1, final: -1 };
      },
      error: () => {
        if (revision === this.detailRevision && this.selected?.id === tournament.id) {
          this.showError(t('communities.matches.detailError'));
        }
      }
    });
  }

  /** Race championships read real rounds, not fake 1-vs-1 fixtures. */
  loadRaceOverview(): void {
    const tournament = this.selected;
    if (!tournament || tournament.scoringMode !== 'RACE_POINTS'
        || !this.isMember || this.detailsLoading) return;
    const cid = this.community.id, revision = ++this.raceRevision;
    this.detailsLoading = true;
    this.raceError = false;
    this.api.raceOverview(cid, tournament.id).pipe(
      timeout(12000),
      finalize(() => {
        if (revision === this.raceRevision) {
          this.detailsLoading = false;
          this.changeDetector.markForCheck();
        }
      })
    ).subscribe({
      next: result => {
        if (revision !== this.raceRevision || this.community.id !== cid
            || this.selected?.id !== tournament.id) return;
        this.raceOverview = result;
        this.racePointsDraft = result.pointsByPlace.join(',');
      },
      error: () => {
        if (revision === this.raceRevision && this.selected?.id === tournament.id) {
          this.raceError = true;
          this.showError(t('communities.karting.loadErrorToast'));
        }
      }
    });
  }

  async linkTournamentRace(roundId: number): Promise<void> {
    if (!this.selected || !this.canManage || this.isRaceCompetition === false) return;
    await this.mutate(this.api.linkRace(this.community.id, this.selected.id, roundId),
      t('communities.karting.raceLinked'), result => {
        this.raceOverview = result;
        this.updateSelected({ ...this.selected!, status: 'IN_PROGRESS' });
      });
  }

  async unlinkTournamentRace(roundId: number): Promise<void> {
    if (!this.selected || !this.canManage || this.isRaceCompetition === false) return;
    await this.mutate(this.api.unlinkRace(this.community.id, this.selected.id, roundId),
      t('communities.karting.raceUnlinked'), result => {
        this.raceOverview = result;
        if (!result.linkedRaces.length) {
          this.updateSelected({ ...this.selected!, status: 'DRAFT', startedAt: null });
        }
      });
  }

  get canCompleteRace(): boolean {
    return this.isRaceCompetition && this.canManage && !this.busy
      && this.selected?.status === 'IN_PROGRESS'
      && (this.raceOverview?.linkedRaces.length ?? 0) > 0
      && (this.raceOverview?.standings.length ?? 0) >= 2
      && !this.detailsLoading && !this.raceError;
  }

  async completeRace(): Promise<void> {
    if (!this.selected || !this.canCompleteRace || this.confirmAction !== 'completeRace') return;
    const tournamentId = this.selected.id;
    this.confirmAction = null;
    await this.mutate(this.api.completeRaceChampionship(this.community.id, tournamentId),
      t('communities.karting.finishSaved'), tournament => {
        this.updateSelected(tournament);
        this.raceOverview = undefined;
        this.loadRaceOverview();
      });
  }

  async saveRacePoints(): Promise<void> {
    if (!this.selected || !this.canManage || !this.isRaceCompetition
        || this.raceOverview?.linkedRaces.length || this.selected.status !== 'DRAFT') return;
    const text = this.racePointsDraft.trim();
    const points = text.split(',').map(v => v.trim());
    if (points.length < 1 || points.length > 20
        || points.some((p, i) => !/^\d{1,4}$/.test(p)
          || Number(p) > 1000
          || (i > 0 && Number(p) > Number(points[i - 1])))) {
      this.showError(t('communities.karting.pointsInvalid'));
      return;
    }
    await this.mutate(this.api.setRacePoints(this.community.id, this.selected.id, text),
      t('communities.karting.pointsSaved'), result => {
        this.raceOverview = result;
        this.racePointsDraft = result.pointsByPlace.join(',');
      });
  }

  loadMoreParticipants(): void {
    if (!this.selected || !this.isMember || this.busy || !this.participantsHasMore) return;
    const cid = this.community.id, tid = this.selected.id, revision = this.detailRevision;
    this.busy = true;
    this.api.participants(cid, tid, this.participantsPage + 1).pipe(
      timeout(12000), finalize(() => {
        if (revision === this.detailRevision && this.selected?.id === tid && this.community.id === cid) {
          this.busy = false;
          this.changeDetector.markForCheck();
        }
      })
    ).subscribe({
      next: result => {
        if (revision !== this.detailRevision || this.selected?.id !== tid || this.community.id !== cid) return;
        this.participants = [...this.participants, ...result.participants];
        this.participantsPage = result.page;
        this.participantsHasMore = result.hasMore;
      },
      error: () => {
        if (revision === this.detailRevision && this.selected?.id === tid && this.community.id === cid) {
          this.showError(t('communities.tournaments.organizerUi.participantsLoadError'));
        }
      }
    });
  }

  loadMoreMatches(): void {
    if (!this.selected || !this.isMember || this.busy || !this.matchesHasMore) return;
    const cid = this.community.id, tid = this.selected.id, revision = this.detailRevision;
    this.busy = true;
    this.api.matches(cid, tid, this.matchesPage + 1).pipe(
      timeout(12000), finalize(() => {
        if (revision === this.detailRevision && this.selected?.id === tid && this.community.id === cid) {
          this.busy = false;
          this.changeDetector.markForCheck();
        }
      })
    ).subscribe({
      next: result => {
        if (revision !== this.detailRevision || this.selected?.id !== tid || this.community.id !== cid) return;
        this.matches = [...this.matches, ...result.matches];
        this.matchesPage = result.page;
        this.matchesHasMore = result.hasMore;
        this.updateDraftScores(result.matches);
      },
      error: () => {
        if (revision === this.detailRevision && this.selected?.id === tid && this.community.id === cid) {
          this.showError(t('communities.tournaments.organizerUi.matchesLoadError'));
        }
      }
    });
  }

  private updateDraftScores(matches: TournamentMatch[]): void {
    for (const match of matches) {
      this.scoreDrafts[match.id] = { home: match.homeScore, away: match.awayScore };
    }
  }

  scoreDraft(match: TournamentMatch): { home: number | null; away: number | null } {
    return this.scoreDrafts[match.id] || { home: match.homeScore, away: match.awayScore };
  }

  setScore(match: TournamentMatch, side: 'home' | 'away', value: number | null): void {
    if (!this.scoreDrafts[match.id]) this.scoreDrafts[match.id] = this.scoreDraft(match);
    this.scoreDrafts[match.id][side] = value;
    this.scoreTouched.add(match.id);
  }

  validScore(value: number | null): boolean {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 999;
  }

  startIndividualCreation(): void {
    if (!this.canManage || this.community?.individualTournamentsEnabled === false || this.busy) return;
    this.showGuide = false;
    this.showTeamCreate = false;
    this.showIndividualCreate = true;
    this.editingSport = false;
    this.sportSearch = '';
    this.error = '';
  }

  startTeamCreation(): void {
    if (!this.canManage || this.community?.teamTournamentsEnabled === false || this.busy) return;
    this.showGuide = false;
    this.showIndividualCreate = false;
    this.showTeamCreate = true;
    this.editingSport = false;
    this.sportSearch = '';
    this.error = '';
  }

  /** A roster is independent of the older individual participant/fixture endpoints. */
  loadTeams(): void {
    const tournament = this.selected;
    if (!tournament || tournament.entryType !== 'TEAM' || !this.isMember || this.detailsLoading) return;
    const communityId = this.community.id;
    const revision = ++this.detailRevision;
    this.detailsLoading = true;
    this.teamsLoadError = false;
    this.api.teams(communityId, tournament.id).pipe(
      timeout(12000),
      finalize(() => {
        if (revision === this.detailRevision) {
          this.detailsLoading = false;
          this.changeDetector.markForCheck();
        }
      })
    ).subscribe({
      next: teams => {
        if (revision !== this.detailRevision || this.community.id !== communityId
            || this.selected?.id !== tournament.id) return;
        this.teams = teams;
        this.teamPlayerDraft = {};
        if (tournament.status !== 'DRAFT') {
          this.loadTeamMatches(true);
          if (tournament.format === 'LEAGUE') this.loadTeamStandings();
          if (tournament.format === 'GROUP_KNOCKOUT') this.loadGroupStandings();
        }
      },
      error: () => {
        if (revision === this.detailRevision && this.community.id === communityId
            && this.selected?.id === tournament.id) {
          this.teamsLoadError = true;
          this.showError(t('communities.tournaments.organizerUi.teamLoadError'));
        }
      }
    });
  }

  loadTeamMatches(reset = false): void {
    const tournament = this.selected;
    if (!tournament || tournament.entryType !== 'TEAM'
        || tournament.status === 'DRAFT' || !this.isMember || this.teamMatchesLoading) return;
    const cid = this.community.id;
    const revision = ++this.teamMatchesRevision;
    const page = reset ? 0 : this.teamMatchesPage + 1;
    this.teamMatchesLoading = true;
    this.teamMatchesError = false;
    this.api.teamMatches(cid, tournament.id, page).pipe(
      timeout(12000),
      finalize(() => {
        if (revision === this.teamMatchesRevision) {
          this.teamMatchesLoading = false;
          this.changeDetector.markForCheck();
        }
      })
    ).subscribe({
      next: result => {
        if (revision !== this.teamMatchesRevision || this.community.id !== cid
            || this.selected?.id !== tournament.id) return;
        this.teamMatches = reset ? result.matches : [...this.teamMatches, ...result.matches];
        this.teamMatchesPage = page;
        this.teamMatchesHasMore = result.hasMore;
        for (const game of result.matches) {
          this.teamScoreDrafts[game.id] = { home: game.homeScore ?? null, away: game.awayScore ?? null };
        }
      },
      error: () => {
        if (revision !== this.teamMatchesRevision || this.community.id !== cid
            || this.selected?.id !== tournament.id) return;
        this.teamMatchesError = true;
        this.showError(t('communities.tournaments.organizerUi.teamMatchesLoadError'));
      }
    });
  }


  loadTeamStandings(): void {
    const tournament = this.selected;
    if (!tournament || tournament.entryType !== 'TEAM'
        || tournament.status === 'DRAFT' || tournament.format === 'KNOCKOUT'
        || !this.isMember) return;
    const communityId = this.community.id;
    const revision = ++this.teamStandingsRevision;
    this.teamStandingsLoading = true;
    this.teamStandingsError = false;
    this.api.teamStandings(communityId, tournament.id).pipe(
      timeout(12000),
      finalize(() => {
        if (revision === this.teamStandingsRevision) {
          this.teamStandingsLoading = false;
          this.changeDetector.markForCheck();
        }
      })
    ).subscribe({
      next: table => {
        if (revision !== this.teamStandingsRevision || this.community.id !== communityId
            || this.selected?.id !== tournament.id) return;
        this.teamStandings = table;
      },
      error: () => {
        if (revision !== this.teamStandingsRevision || this.community.id !== communityId
            || this.selected?.id !== tournament.id) return;
        this.teamStandings = undefined;
        this.teamStandingsError = true;
      }
    });
  }

  loadGroupStandings(): void {
    const tournament = this.selected;
    if (!tournament || tournament.format !== 'GROUP_KNOCKOUT'
        || tournament.status === 'DRAFT' || !this.isMember) return;
    const cid = this.community.id;
    const revision = ++this.teamGroupsRevision;
    this.teamGroupsLoading = true;
    this.teamGroupsError = false;
    this.api.teamGroups(cid, tournament.id).pipe(
      timeout(12000),
      finalize(() => {
        if (revision === this.teamGroupsRevision) {
          this.teamGroupsLoading = false;
          this.changeDetector.markForCheck();
        }
      })
    ).subscribe({
      next: groups => {
        if (revision !== this.teamGroupsRevision || this.community.id !== cid
            || this.selected?.id !== tournament.id) return;
        this.teamGroups = groups;
      },
      error: () => {
        if (revision !== this.teamGroupsRevision || this.community.id !== cid
            || this.selected?.id !== tournament.id) return;
        this.teamGroups = undefined;
        this.teamGroupsError = true;
      }
    });
  }

  teamScoreDraft(match: TournamentTeamMatch): { home: number | null; away: number | null } {
    return this.teamScoreDrafts[match.id]
      || { home: match.homeScore ?? null, away: match.awayScore ?? null };
  }

  setTeamScore(match: TournamentTeamMatch, side: 'home' | 'away', value: number | null): void {
    if (!this.teamScoreDrafts[match.id]) {
      this.teamScoreDrafts[match.id] = { ...this.teamScoreDraft(match) };
    }
    this.teamScoreDrafts[match.id][side] = value;
    this.teamScoreTouched.add(match.id);
  }

  isTeamScoreInvalid(match: TournamentTeamMatch): boolean {
    const score = this.teamScoreDraft(match);
    return this.teamScoreTouched.has(match.id)
      && (!this.validScore(score.home) || !this.validScore(score.away)
        || (this.isEliminationMatch(match) && score.home === score.away));
  }

  async saveTeamScore(match: TournamentTeamMatch): Promise<void> {
    if (!this.selected || !this.canManage || this.selected.entryType !== 'TEAM'
        || this.selected.status !== 'IN_PROGRESS' || this.isPastKnockoutRound(match)) return;
    const score = this.teamScoreDraft(match);
    if (!this.validScore(score.home) || !this.validScore(score.away)) {
      this.showError(t('communities.tournaments.organizerUi.invalidScores'));
      return;
    }
    if (this.isEliminationMatch(match) && score.home === score.away) {
      this.showError(t('communities.tournaments.organizerUi.knockoutNeedsWinner'));
      return;
    }
    await this.mutate(this.api.recordTeamResult(this.community.id, this.selected.id, match.id,
      score.home!, score.away!), t('communities.tournaments.organizerUi.teamScoreSaved'), saved => {
      this.teamMatches = this.teamMatches.map(game => game.id === saved.id ? saved : game);
      this.teamScoreDrafts[saved.id] = { home: saved.homeScore ?? null, away: saved.awayScore ?? null };
      this.teamScoreTouched.delete(saved.id);
      if (this.isEliminationMatch(saved)) {
        if (saved.roundNumber === this.knockoutTotalRounds && saved.homeScore !== saved.awayScore) {
          const homeWins = saved.homeScore! > saved.awayScore!;
          this.updateSelected({
            ...this.selected!, status: 'COMPLETED',
            championTeamId: homeWins ? saved.homeTeamId : saved.awayTeamId,
            championTeamName: homeWins ? saved.homeTeamName : saved.awayTeamName,
            championTied: false, championPoints: null
          });
        }
        this.loadTeamMatches(true);
      } else if (this.isGroupKnockout) {
        this.loadGroupStandings();
        this.loadTeamMatches(true);
      } else {
        this.loadTeamStandings();
      }
    });
  }

  async publishTeamSchedule(): Promise<void> {
    const tournament = this.selected;
    if (!tournament || !this.canPublishTeamSchedule || this.confirmAction !== 'schedule') return;
    this.confirmAction = null;
    await this.mutate(this.api.generateTeamSchedule(this.community.id, tournament.id),
      t('communities.tournaments.organizerUi.teamSchedulePublished'), () => {
        this.updateSelected({ ...tournament, status: 'IN_PROGRESS' });
        this.teamMatches = [];
        this.loadDetails();
      });
  }

  async createTeamCompetition(): Promise<void> {
    const name = this.nameDraft.trim();
    if (!this.canManage || this.community.teamTournamentsEnabled === false || !this.showTeamCreate || this.busy) return;
    if (name.length < 2 || name.length > 120) {
      this.showError(t('communities.tournaments.organizerUi.invalidName'));
      return;
    }
    if (!this.sportDraft || !(SPORTS_CATALOG.includes(this.sportDraft)
        || this.communitySportOptions.includes(this.sportDraft))) {
      this.showError(t('communities.tournaments.organizerUi.invalidSport'));
      return;
    }
    if (!this.isSportFormatSupported) {
      this.showError(this.sportFormatWarning);
      return;
    }
    if (this.teamFormatDraft === 'LEAGUE'
        && this.roundRobinLegsDraft !== 1 && this.roundRobinLegsDraft !== 2) {
      this.showError(t('communities.tournaments.organizerUi.invalidLegs'));
      return;
    }
    if (this.teamFormatDraft !== 'KNOCKOUT' && !this.validPointRules) {
      this.showError(t('communities.tournaments.organizerUi.invalidPoints'));
      return;
    }
    if (this.teamFormatDraft !== 'KNOCKOUT'
        && !this.teamTieBreakChoices.some(choice => choice.value === this.teamTieBreakPriorityDraft)) {
      this.showError(t('communities.tournaments.organizerUi.invalidTiebreak'));
      return;
    }
    const createRequest = this.teamFormatDraft === 'GROUP_KNOCKOUT'
      ? this.api.createTeamTournament(this.community.id, name, this.sportDraft, null,
          this.roundRobinLegsDraft, this.pointRulesDraft, this.teamTieBreakPriorityDraft,
          this.teamFormatDraft, this.teamGroupCountDraft)
      : this.api.createTeamTournament(this.community.id, name, this.sportDraft, null,
          this.roundRobinLegsDraft, this.pointRulesDraft, this.teamTieBreakPriorityDraft,
          this.teamFormatDraft);
    await this.mutate(createRequest,
      t('communities.tournaments.organizerUi.teamCreatedCompetition'), result => {
        this.nameDraft = '';
        this.roundRobinLegsDraft = 1;
        this.teamFormatDraft = 'LEAGUE';
        this.teamGroupCountDraft = 2;
        this.teamTieBreakPriorityDraft = 'GOAL_DIFFERENCE_FIRST';
        this.resetPointRules();
        this.showTeamCreate = false;
        this.selected = undefined;
        this.selectTournament(result);
        this.tournaments = [result, ...this.tournaments.filter(item => item.id !== result.id)];
      });
  }

  async createTournamentTeam(): Promise<void> {
    if (!this.canManageTeamRoster || !this.selected) return;
    const name = this.teamNameDraft.trim().replace(/\s+/g, ' ');
    if (!name || name.length > 100) {
      this.showError(t('communities.tournaments.organizerUi.invalidTeamName'));
      return;
    }
    if (this.teams.length >= 32) {
      this.showError(t('communities.tournaments.organizerUi.teamLimit'));
      return;
    }
    await this.mutate(this.api.createTeam(this.community.id, this.selected.id, name),
      t('communities.tournaments.organizerUi.teamCreated'), () => { this.teamNameDraft = ''; this.loadTeams(); });
  }

  async assignTeamPlayer(team: TournamentTeam): Promise<void> {
    const id = this.teamPlayerDraft[team.id];
    if (!this.canManageTeamRoster || !this.selected || id == null || !Number.isInteger(id)
        || this.isTeamRosterFull(team)
        || !this.availableTeamMembers.some(member => member.profileId === id)) return;
    await this.mutate(this.api.addTeamPlayer(this.community.id, this.selected.id, team.id, id),
      t('communities.tournaments.organizerUi.teamPlayerAdded'), () => this.loadTeams());
  }

  async removeTeamPlayer(team: TournamentTeam, profileId: number): Promise<void> {
    if (!this.canManageTeamRoster || !this.selected
        || !team.players.some(p => p.profileId === profileId)) return;
    await this.mutate(this.api.removeTeamPlayer(this.community.id, this.selected.id, team.id, profileId),
      t('communities.tournaments.organizerUi.teamPlayerRemoved'), () => this.loadTeams());
  }

  async deleteTournamentTeam(team: TournamentTeam): Promise<void> {
    if (!this.canManageTeamRoster || !this.selected || team.players.length > 0) return;
    await this.mutate(this.api.deleteTeam(this.community.id, this.selected.id, team.id),
      t('communities.tournaments.organizerUi.teamDeleted'), () => this.loadTeams());
  }

  async create(): Promise<void> {
    const name = this.nameDraft.trim();
    if (!this.canManage || this.community?.individualTournamentsEnabled === false
        || !this.showIndividualCreate || this.busy || name.length < 2 || name.length > 120) {
      this.showError(t('communities.tournaments.organizerUi.invalidName'));
      return;
    }
    if (!this.sportDraft || !(SPORTS_CATALOG.includes(this.sportDraft)
      || this.communitySportOptions.includes(this.sportDraft))) {
      this.showError(t('communities.tournaments.organizerUi.invalidSport'));
      return;
    }
    if (!this.isSportFormatSupported) {
      this.showError(t('communities.tournaments.organizerUi.individualUnsupported'));
      return;
    }
    if (!this.isRaceChampionshipDraft && !this.isInlineSpeedDraft && !this.validPointRules) {
      this.showError(t('communities.tournaments.organizerUi.invalidPoints'));
      return;
    }
    const scoringMode = this.classificationProfile.scoringMode;
    const createRequest = this.isInlineSpeedDraft
      ? this.api.create(this.community.id, name, this.sportDraft,
          { winPoints: 0, drawPoints: 0, lossPoints: 0 })
      : this.isRaceChampionshipDraft
      ? this.api.createRaceChampionship(this.community.id, name, this.sportDraft as RaceChampionshipSport)
      : scoringMode
      ? this.api.create(this.community.id, name, this.sportDraft, this.pointRulesDraft, scoringMode)
      : this.api.create(this.community.id, name, this.sportDraft, this.pointRulesDraft);
    await this.mutate(createRequest,
      t('communities.tournaments.organizerUi.competitionCreated'), result => {
      this.nameDraft = '';
      this.resetPointRules();
      this.showIndividualCreate = false;
      this.selected = undefined;
      this.selectTournament(result);
      this.tournaments = [result, ...this.tournaments.filter(item => item.id !== result.id)];
    });
  }


  async deleteSelected(): Promise<void> {
    if (!this.canManage || !this.selected || this.selected.status === 'COMPLETED'
        || this.confirmAction !== 'delete' || this.busy) return;
    const tournamentId = this.selected.id;
    this.confirmAction = null;
    await this.mutate(this.api.delete(this.community.id, tournamentId),
      t('communities.tournaments.organizerUi.competitionDeleted'), () => {
        this.selected = undefined;
        this.tournaments = this.tournaments.filter(item => item.id !== tournamentId);
        this.participants = [];
        this.matches = [];
        this.standings = undefined;
        ++this.detailRevision;
        ++this.standingsRevision;
        this.loadTournaments(true);
      });
  }

  async join(): Promise<void> {
    if (!this.selected || !this.isMember || this.selected.status !== 'DRAFT'
        || this.myEnrollment || this.participantsHasMore) return;
    await this.mutate(this.api.join(this.community.id, this.selected.id),
      t('communities.tournaments.organizerUi.registrationUpdated'), () => this.refreshRosterAndFocus());
  }

  async leave(): Promise<void> {
    if (!this.selected || !this.isMember || this.selected.status !== 'DRAFT'
        || !this.myEnrollment) return;
    await this.mutate(this.api.leave(this.community.id, this.selected.id),
      t('communities.tournaments.organizerUi.registrationCancelled'), () => this.refreshRosterAndFocus());
  }

  async confirm(participant: TournamentParticipant): Promise<void> {
    if (!this.selected || !this.canManage || this.selected.status !== 'DRAFT') return;
    await this.mutate(this.api.confirm(this.community.id, this.selected.id, participant.profileId),
      t('communities.tournaments.organizerUi.participantConfirmed'), () => this.refreshRosterAndFocus());
  }

  async remove(participant: TournamentParticipant): Promise<void> {
    if (!this.selected || !this.canManage || this.selected.status !== 'DRAFT') return;
    await this.mutate(this.api.removeParticipant(this.community.id, this.selected.id, participant.profileId),
      t('communities.tournaments.organizerUi.participantRemoved'), () => this.refreshRosterAndFocus());
  }

  async publishSchedule(): Promise<void> {
    const tournament = this.selected;
    if (!tournament || !this.canPublishSchedule || this.confirmAction !== 'schedule') return;
    const tournamentId = tournament.id;
    this.confirmAction = null;
    await this.mutate(this.api.generateSchedule(this.community.id, tournamentId),
      t('communities.tournaments.individualUi.schedulePublished'), () => {
        this.updateSelected({ ...this.selected!, status: 'IN_PROGRESS' });
        this.loadDetails();
      });
  }

  async saveScore(match: TournamentMatch): Promise<void> {
    if (!this.selected || !this.canManage || this.selected.status !== 'IN_PROGRESS') return;
    const score = this.scoreDraft(match);
    if (!this.validTournamentScore(match)) {
      this.showError(this.isChessTournament
        ? t('communities.tournaments.individualUi.chessInvalidToast')
        : t('communities.tournaments.individualUi.scoresInvalidToast'));
      return;
    }
    await this.mutate(
      this.api.recordResult(this.community.id, this.selected.id, match.id, score.home!, score.away!),
      t('communities.tournaments.individualUi.resultSaved'), saved => {
        // Keep the already-loaded fixture pages visible, including distant rounds.
        this.matches = this.matches.map(game => game.id === saved.id ? saved : game);
        this.scoreDrafts[saved.id] = { home: saved.homeScore, away: saved.awayScore };
        this.scoreTouched.delete(saved.id);
        this.refreshStandings();
      }
    );
  }

  async completeTeam(): Promise<void> {
    if (!this.selected || !this.canCompleteTeam || this.confirmAction !== 'completeTeam') return;
    const tournamentId = this.selected.id;
    this.confirmAction = null;
    await this.mutate(this.api.completeTeam(this.community.id, tournamentId),
      t('communities.tournaments.organizerUi.teamCompetitionCompleted'), tournament => {
        this.updateSelected(tournament);
        this.loadDetails();
      });
  }

  async complete(): Promise<void> {
    if (!this.selected || !this.canManage || !this.canComplete || this.confirmAction !== 'complete') return;
    const tournamentId = this.selected.id;
    this.confirmAction = null;
    await this.mutate(this.api.complete(this.community.id, tournamentId),
      t('communities.tournaments.organizerUi.individualCompetitionCompleted'), tournament => {
        this.updateSelected(tournament);
        this.loadDetails();
      });
  }

  private refreshStandings(): void {
    const tournament = this.selected;
    if (!tournament || !this.isMember) return;
    const communityId = this.community.id;
    const revision = ++this.standingsRevision;
    this.api.standings(communityId, tournament.id).pipe(timeout(12000)).subscribe({
      next: table => {
        if (revision === this.standingsRevision && this.community.id === communityId
            && this.selected?.id === tournament.id) {
          this.standings = table;
          this.changeDetector.markForCheck();
        }
      },
      error: () => {
        if (revision === this.standingsRevision && this.community.id === communityId
            && this.selected?.id === tournament.id) {
          this.standings = undefined;
          this.showError(t('communities.tournaments.organizerUi.standingsRefreshError'));
        }
      }
    });
  }

  private updateSelected(tournament: CommunityTournament): void {
    this.selected = tournament;
    this.tournaments = this.tournaments.map(item => item.id === tournament.id ? tournament : item);
  }

  private async mutate<T>(operation: Observable<T>, success: string, after: (result: T) => void): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    this.error = '';
    this.feedback = '';
    const cid = this.community.id, tid = this.selected?.id;
    const mutationRevision = ++this.mutationRevision;
    try {
      const result = await firstValueFrom(operation.pipe(timeout(12000)));
      if (mutationRevision !== this.mutationRevision || this.community.id !== cid
          || (tid !== undefined && this.selected?.id !== tid)) return;
      after(result);
      // Selection of a newly created tournament clears old notices: set the
      // current operation's success message only after switching views.
      this.feedback = success;
    } catch (error: any) {
      if (mutationRevision !== this.mutationRevision || this.community.id !== cid
          || (tid !== undefined && this.selected?.id !== tid)) return;
      const detail: unknown = error?.error?.detail || error?.error?.message;
      const safeDetail = typeof detail === 'string' && detail.trim().length > 0
        && detail.length <= 180 ? detail : null;
      // Keep the detailed server response for PT. In EN, never surface an
      // untranslated arbitrary backend string. The known completion conflict
      // keeps its exact meaning in either language.
      const knownConflict = safeDetail?.trim() === 'Todos os confrontos da liga precisam de estar concluídos';
      const english = typeof localStorage !== 'undefined'
        && localStorage.getItem('d24-language') === 'en';
      this.showError(knownConflict
        ? t('communities.tournaments.organizerUi.completeAllMatches')
        : (!english && safeDetail ? safeDetail
          : t('communities.tournaments.organizerUi.mutationFallback')));
    } finally {
      if (mutationRevision === this.mutationRevision) {
        this.busy = false;
        this.changeDetector.markForCheck();
      }
    }
  }

  formatStatus(status: string): string {
    switch (status) {
      case 'DRAFT': return t('communities.tournaments.individualUi.statusDraft');
      case 'IN_PROGRESS': return t('communities.tournaments.individualUi.statusInProgress');
      case 'COMPLETED': return t('communities.tournaments.individualUi.statusCompleted');
      case 'PENDING': return t('communities.tournaments.individualUi.statusPending');
      case 'CONFIRMED': return t('communities.tournaments.individualUi.statusConfirmed');
      case 'SCHEDULED': return t('communities.tournaments.individualUi.statusScheduled');
      default: return status;
    }
  }

  playerLabel(row: TournamentStandingRow): string {
    return row.displayName || row.username;
  }
}
