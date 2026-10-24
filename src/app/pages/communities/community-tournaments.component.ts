import { ChangeDetectorRef, Component, ElementRef, Input, OnChanges, SimpleChanges, ViewChild } from '@angular/core';
import { finalize, firstValueFrom, forkJoin, Observable, timeout } from 'rxjs';
import { CommunityGroup } from '../model/community-group';
import {
  CommunityTournament, TournamentPointRules, TeamTieBreakPriority, TournamentMatch, TournamentParticipant, TournamentStandingRow,
  TournamentStandings, TournamentTeam, TournamentTeamMatch, TournamentTeamStandings, TournamentTeamGroups,
  TournamentRaceOverview
} from '../model/community-tournament';
import { CommunityTournamentsService } from '../../services/community-tournaments.service';
import { AuthenticationService } from '../../services/authethication.service';
import { tournamentScoreTerminology } from './community-tournament-scoring';
import { formatForSport } from './community-round-sport';
import { tournamentClassificationProfile } from './community-tournament-classification';
import { SPORTS_CATALOG } from '../../shared/sports-catalog';
import { buildTournamentTeamInviteUrl, teamInvitationWhatsAppUrl } from './community-team-invite';

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

  readonly teamTieBreakChoices: ReadonlyArray<{
    value: TeamTieBreakPriority;
    title: string;
    explanation: string;
  }> = [
    { value: 'GOAL_DIFFERENCE_FIRST', title: 'Diferença do marcador',
      explanation: 'Primeiro a diferença entre o que cada equipa marcou e sofreu.' },
    { value: 'GOALS_SCORED_FIRST', title: 'Marcador a favor',
      explanation: 'Primeiro quem marcou mais ao longo do campeonato.' },
    { value: 'WINS_FIRST', title: 'Mais vitórias',
      explanation: 'Primeiro quem ganhou mais confrontos.' }
  ];

  teamTieBreakLabel(priority: TeamTieBreakPriority | null | undefined): string {
    return this.teamTieBreakChoices.find(choice =>
      choice.value === (priority ?? 'GOAL_DIFFERENCE_FIRST'))?.title
      ?? 'Diferença do marcador';
  }

  get classificationProfile() {
    return tournamentClassificationProfile(this.sportDraft);
  }

  get isKartingRaceDraft(): boolean {
    return !this.showTeamCreate && this.sportDraft.trim().toLowerCase() === 'karting';
  }

  get isRaceCompetition(): boolean {
    return this.selected?.scoringMode === 'RACE_POINTS';
  }

  get isSportFormatSupported(): boolean {
    return this.isKartingRaceDraft || this.classificationProfile.isRoundRobinSupported
      && !(this.showTeamCreate && this.classificationProfile.scoringMode === 'CHESS_HALF_POINTS');
  }

  get sportFormatWarning(): string {
    if (this.isKartingRaceDraft) {
      return 'As posições, tempos, penalizações e desclassificações vêm das corridas registadas nas Jornadas. Associa as corridas depois de criares o campeonato.';
    }
    return this.showTeamCreate && this.classificationProfile.scoringMode === 'CHESS_HALF_POINTS'
      ? 'O Xadrez por equipas precisa de partidas e resultados por tabuleiro. Para já, cria uma liga individual de Xadrez.'
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
    return tournamentScoreTerminology(this.selected?.entryType === 'TEAM' ? null : this.selected?.sport);
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
      this.inviteCopyFeedback[team.id] = 'Link copiado! Partilha-o com os jogadores.';
    } catch {
      this.inviteCopyFeedback[team.id] = 'Não foi possível copiar. Abre o link para partilhar manualmente.';
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
      'Convite aceite! Já fazes parte da equipa ' + team.name + '.',
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
      return (this.isKnockout ? 'Ronda ' : 'Jornada ') + game.roundNumber;
    }
    if (game.groupNumber != null) {
      return 'Grupo ' + this.groupLabel(game.groupNumber) + ' · Jornada ' + game.roundNumber;
    }
    const totalRounds = this.selected?.groupCount === 4 ? 3 : 2;
    const remaining = totalRounds - game.roundNumber;
    return remaining === 2 ? 'Quartos de final'
      : remaining === 1 ? 'Meias-finais'
      : remaining === 0 ? 'Final'
      : 'Ronda eliminatória ' + game.roundNumber;
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
                    this.showError('O torneio deste convite já não está disponível.');
                  }
                }
              });
          }
        } else if (reset && !this.selected && result.tournaments.length) {
          this.selectTournament(result.tournaments[0]);
        }
      },
      error: () => {
        if (revision === this.listRevision) this.showError('Não foi possível carregar os torneios. Tenta novamente.');
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
    if (tournament.entryType === 'TEAM') {
      this.loadTeams();
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
          this.showError('Não foi possível carregar os dados do torneio.');
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
          this.showError('Não foi possível carregar as corridas do campeonato.');
        }
      }
    });
  }

  async linkTournamentRace(roundId: number): Promise<void> {
    if (!this.selected || !this.canManage || this.isRaceCompetition === false) return;
    await this.mutate(this.api.linkRace(this.community.id, this.selected.id, roundId),
      'Corrida associada ao campeonato.', result => {
        this.raceOverview = result;
        this.updateSelected({ ...this.selected!, status: 'IN_PROGRESS' });
      });
  }

  async unlinkTournamentRace(roundId: number): Promise<void> {
    if (!this.selected || !this.canManage || this.isRaceCompetition === false) return;
    await this.mutate(this.api.unlinkRace(this.community.id, this.selected.id, roundId),
      'Corrida retirada do campeonato. O resultado continua nas jornadas.', result => {
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
    await this.mutate(this.api.completeKarting(this.community.id, tournamentId),
      'Campeonato de Karting encerrado. Campeão e classificação final arquivados.', tournament => {
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
      this.showError('Indica até 20 pontos inteiros decrescentes, entre 0 e 1000, separados por vírgulas.');
      return;
    }
    await this.mutate(this.api.setRacePoints(this.community.id, this.selected.id, text),
      'Pontuação por posição guardada.', result => {
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
          this.showError('Não foi possível carregar mais participantes.');
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
          this.showError('Não foi possível carregar mais jogos.');
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
          this.showError('Não foi possível carregar as equipas. Usa Atualizar para tentar novamente.');
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
        this.showError('Não foi possível carregar os confrontos por equipas. Tenta novamente.');
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
      this.showError('Os resultados devem ser números inteiros entre 0 e 999.');
      return;
    }
    if (this.isEliminationMatch(match) && score.home === score.away) {
      this.showError('Nas eliminatórias, o resultado tem de definir um vencedor.');
      return;
    }
    await this.mutate(this.api.recordTeamResult(this.community.id, this.selected.id, match.id,
      score.home!, score.away!), 'Resultado por equipas guardado.', saved => {
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
      'Calendário por equipas publicado. Os plantéis estão agora fechados.', () => {
        this.updateSelected({ ...tournament, status: 'IN_PROGRESS' });
        this.teamMatches = [];
        this.loadDetails();
      });
  }

  async createTeamCompetition(): Promise<void> {
    const name = this.nameDraft.trim();
    if (!this.canManage || this.community.teamTournamentsEnabled === false || !this.showTeamCreate || this.busy) return;
    if (name.length < 2 || name.length > 120) {
      this.showError('Indica um nome entre 2 e 120 caracteres.');
      return;
    }
    if (!this.sportDraft || !(SPORTS_CATALOG.includes(this.sportDraft)
        || this.communitySportOptions.includes(this.sportDraft))) {
      this.showError('Escolhe uma modalidade válida para o torneio.');
      return;
    }
    if (!this.isSportFormatSupported) {
      this.showError(this.sportFormatWarning);
      return;
    }
    if (this.teamFormatDraft === 'LEAGUE'
        && this.roundRobinLegsDraft !== 1 && this.roundRobinLegsDraft !== 2) {
      this.showError('Escolhe uma ou duas voltas.');
      return;
    }
    if (this.teamFormatDraft !== 'KNOCKOUT' && !this.validPointRules) {
      this.showError('Define pontos inteiros entre 0 e 100 para vitória, empate e derrota.');
      return;
    }
    if (this.teamFormatDraft !== 'KNOCKOUT'
        && !this.teamTieBreakChoices.some(choice => choice.value === this.teamTieBreakPriorityDraft)) {
      this.showError('Escolhe um critério de desempate válido.');
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
      'Competição por equipas criada. Agora podes preparar os plantéis.', result => {
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
      this.showError('Indica o nome da equipa (até 100 caracteres).');
      return;
    }
    if (this.teams.length >= 32) {
      this.showError('Esta versão permite até 32 equipas.');
      return;
    }
    await this.mutate(this.api.createTeam(this.community.id, this.selected.id, name),
      'Equipa criada.', () => { this.teamNameDraft = ''; this.loadTeams(); });
  }

  async assignTeamPlayer(team: TournamentTeam): Promise<void> {
    const id = this.teamPlayerDraft[team.id];
    if (!this.canManageTeamRoster || !this.selected || id == null || !Number.isInteger(id)
        || this.isTeamRosterFull(team)
        || !this.availableTeamMembers.some(member => member.profileId === id)) return;
    await this.mutate(this.api.addTeamPlayer(this.community.id, this.selected.id, team.id, id),
      'Jogador adicionado à equipa.', () => this.loadTeams());
  }

  async removeTeamPlayer(team: TournamentTeam, profileId: number): Promise<void> {
    if (!this.canManageTeamRoster || !this.selected
        || !team.players.some(p => p.profileId === profileId)) return;
    await this.mutate(this.api.removeTeamPlayer(this.community.id, this.selected.id, team.id, profileId),
      'Jogador removido do plantel.', () => this.loadTeams());
  }

  async deleteTournamentTeam(team: TournamentTeam): Promise<void> {
    if (!this.canManageTeamRoster || !this.selected || team.players.length > 0) return;
    await this.mutate(this.api.deleteTeam(this.community.id, this.selected.id, team.id),
      'Equipa eliminada.', () => this.loadTeams());
  }

  async create(): Promise<void> {
    const name = this.nameDraft.trim();
    if (!this.canManage || this.community?.individualTournamentsEnabled === false
        || !this.showIndividualCreate || this.busy || name.length < 2 || name.length > 120) {
      this.showError('Indica um nome entre 2 e 120 caracteres.');
      return;
    }
    if (!this.sportDraft || !(SPORTS_CATALOG.includes(this.sportDraft)
      || this.communitySportOptions.includes(this.sportDraft))) {
      this.showError('Escolhe uma modalidade válida para o torneio.');
      return;
    }
    if (!this.isSportFormatSupported) {
      this.showError('Esta modalidade precisa de resultados por prova. Usa as jornadas da comunidade.');
      return;
    }
    if (!this.isKartingRaceDraft && !this.validPointRules) {
      this.showError('Define pontos inteiros entre 0 e 100 para vitória, empate e derrota.');
      return;
    }
    const scoringMode = this.classificationProfile.scoringMode;
    const createRequest = this.isKartingRaceDraft
      ? this.api.createKartingChampionship(this.community.id, name)
      : scoringMode
      ? this.api.create(this.community.id, name, this.sportDraft, this.pointRulesDraft, scoringMode)
      : this.api.create(this.community.id, name, this.sportDraft, this.pointRulesDraft);
    await this.mutate(createRequest,
      'Torneio criado.', result => {
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
      'Competição eliminada.', () => {
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
      'Inscrição atualizada.', () => this.refreshRosterAndFocus());
  }

  async leave(): Promise<void> {
    if (!this.selected || !this.isMember || this.selected.status !== 'DRAFT'
        || !this.myEnrollment) return;
    await this.mutate(this.api.leave(this.community.id, this.selected.id),
      'Inscrição cancelada.', () => this.refreshRosterAndFocus());
  }

  async confirm(participant: TournamentParticipant): Promise<void> {
    if (!this.selected || !this.canManage || this.selected.status !== 'DRAFT') return;
    await this.mutate(this.api.confirm(this.community.id, this.selected.id, participant.profileId),
      'Participante confirmado.', () => this.refreshRosterAndFocus());
  }

  async remove(participant: TournamentParticipant): Promise<void> {
    if (!this.selected || !this.canManage || this.selected.status !== 'DRAFT') return;
    await this.mutate(this.api.removeParticipant(this.community.id, this.selected.id, participant.profileId),
      'Participante removido.', () => this.refreshRosterAndFocus());
  }

  async publishSchedule(): Promise<void> {
    const tournament = this.selected;
    if (!tournament || !this.canPublishSchedule || this.confirmAction !== 'schedule') return;
    const tournamentId = tournament.id;
    this.confirmAction = null;
    await this.mutate(this.api.generateSchedule(this.community.id, tournamentId),
      'Calendário publicado. O torneio começou.', () => {
        this.updateSelected({ ...this.selected!, status: 'IN_PROGRESS' });
        this.loadDetails();
      });
  }

  async saveScore(match: TournamentMatch): Promise<void> {
    if (!this.selected || !this.canManage || this.selected.status !== 'IN_PROGRESS') return;
    const score = this.scoreDraft(match);
    if (!this.validTournamentScore(match)) {
      this.showError(this.isChessTournament
        ? 'Xadrez: seleciona vitória das brancas, empate ou vitória das pretas.'
        : 'Os resultados devem ser números inteiros entre 0 e 999.');
      return;
    }
    await this.mutate(
      this.api.recordResult(this.community.id, this.selected.id, match.id, score.home!, score.away!),
      'Resultado guardado.', saved => {
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
      'Campeonato por equipas encerrado.', tournament => {
        this.updateSelected(tournament);
        this.loadDetails();
      });
  }

  async complete(): Promise<void> {
    if (!this.selected || !this.canManage || !this.canComplete || this.confirmAction !== 'complete') return;
    const tournamentId = this.selected.id;
    this.confirmAction = null;
    await this.mutate(this.api.complete(this.community.id, tournamentId),
      'Torneio encerrado.', tournament => {
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
          this.showError('Resultado guardado, mas não foi possível atualizar a classificação. Usa Atualizar para tentar novamente.');
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
      this.showError(typeof detail === 'string' && detail.length <= 180
        ? detail : 'Não foi possível concluir a operação. Verifica os dados e tenta novamente.');
    } finally {
      if (mutationRevision === this.mutationRevision) {
        this.busy = false;
        this.changeDetector.markForCheck();
      }
    }
  }

  formatStatus(status: string): string {
    switch (status) {
      case 'DRAFT': return 'Inscrições abertas';
      case 'IN_PROGRESS': return 'Em curso';
      case 'COMPLETED': return 'Terminado';
      case 'PENDING': return 'A aguardar aprovação';
      case 'CONFIRMED': return 'Confirmado';
      case 'SCHEDULED': return 'Por disputar';
      default: return status;
    }
  }

  playerLabel(row: TournamentStandingRow): string {
    return row.displayName || row.username;
  }
}
