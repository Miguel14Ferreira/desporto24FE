import { ChangeDetectorRef, Component, ElementRef, Input, OnChanges, SimpleChanges, ViewChild } from '@angular/core';
import { finalize, firstValueFrom, forkJoin, Observable, timeout } from 'rxjs';
import { CommunityGroup } from '../model/community-group';
import {
  CommunityTournament, TournamentMatch, TournamentParticipant, TournamentStandingRow,
  TournamentStandings, TournamentTeam, TournamentTeamMatch
} from '../model/community-tournament';
import { CommunityTournamentsService } from '../../services/community-tournaments.service';
import { AuthenticationService } from '../../services/authethication.service';
import { tournamentScoreTerminology } from './community-tournament-scoring';
import { SPORTS_CATALOG } from '../../shared/sports-catalog';

@Component({
  selector: 'app-community-tournaments',
  templateUrl: './community-tournaments.component.html',
  styleUrls: ['./community-tournaments.component.css'],
  standalone: false
})
export class CommunityTournamentsComponent implements OnChanges {
  @Input({ required: true }) community!: CommunityGroup;

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

  showGuide = false;
  showIndividualCreate = false;
  showTeamCreate = false;
  teamSizeDraft = 5;
  teamNameDraft = '';
  teamPlayerDraft: Record<number, number | null> = {};
  teams: TournamentTeam[] = [];
  teamsLoadError = false;
  teamMatches: TournamentTeamMatch[] = [];
  teamMatchesPage = 0;
  teamMatchesHasMore = false;
  teamMatchesLoading = false;
  teamMatchesError = false;
  private teamMatchesRevision = 0;
  nameDraft = '';
  sportDraft = '';
  sportSearch = '';
  get communitySportOptions(): string[] {
    const selected = this.community?.sports;
    return selected?.length ? selected : (this.community?.sport ? [this.community.sport] : []);
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
    this.sportDraft = sport;
    this.sportSearch = '';
  }

  loading = false;
  detailsLoading = false;
  busy = false;
  error = '';
  feedback = '';
  confirmAction: 'schedule' | 'complete' | 'delete' | null = null;
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

  get nameTooShort(): boolean {
    const len = this.nameDraft.trim().length;
    return len > 0 && len < 2;
  }

  isScoreInvalid(match: TournamentMatch): boolean {
    const score = this.scoreDraft(match);
    return this.scoreTouched.has(match.id)
      && (!this.validScore(score.home) || !this.validScore(score.away));
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
      ++this.teamMatchesRevision;
      this.busy = false;
      this.showGuide = false;
      this.showIndividualCreate = false;
      this.showTeamCreate = false;
      this.teamNameDraft = '';
      this.teamPlayerDraft = {};
      this.teams = [];
      this.teamsLoadError = false;
      this.teamMatches = [];
      this.teamMatchesHasMore = false;
      this.teamMatchesLoading = false;
      this.teamMatchesError = false;
      // A sole community sport is convenient; multi-sport requires an explicit choice.
      const sports = this.community.sports;
      this.sportDraft = sports?.length === 1
        ? sports[0] : (!sports?.length ? this.community.sport || '' : '');
      this.sportSearch = '';
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

  get canManageTeamRoster(): boolean {
    return this.canManage && this.isTeamCompetition && this.selected?.status === 'DRAFT' && !this.busy;
  }

  get readyTeamCount(): number {
    return this.teams.filter(t => t.players.length === t.playersPerTeam).length;
  }

  get canPublishTeamSchedule(): boolean {
    return this.canManageTeamRoster && !this.detailsLoading && !this.teamsLoadError
      && this.teams.length >= 2 && this.teams.length <= 32
      && this.readyTeamCount === this.teams.length;
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
        if (reset && !this.selected && result.tournaments.length) {
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
    ++this.teamMatchesRevision;
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
    this.error = '';
  }

  startTeamCreation(): void {
    if (!this.canManage || this.community?.teamTournamentsEnabled === false || this.busy) return;
    this.showGuide = false;
    this.showIndividualCreate = false;
    this.showTeamCreate = true;
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
        if (tournament.status !== 'DRAFT') this.loadTeamMatches(true);
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
      },
      error: () => {
        if (revision !== this.teamMatchesRevision || this.community.id !== cid
            || this.selected?.id !== tournament.id) return;
        this.teamMatchesError = true;
        this.showError('Não foi possível carregar os confrontos por equipas. Tenta novamente.');
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
    const size = this.teamSizeDraft;
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
    if (!Number.isInteger(size) || size < 1 || size > 30) {
      this.showError('Indica entre 1 e 30 jogadores por equipa.');
      return;
    }
    await this.mutate(this.api.createTeamTournament(this.community.id, name, this.sportDraft, size),
      'Competição por equipas criada. Agora podes preparar os plantéis.', result => {
        this.nameDraft = '';
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
        || team.players.length >= team.playersPerTeam
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
    await this.mutate(this.api.create(this.community.id, name, this.sportDraft),
      'Torneio criado.', result => {
      this.nameDraft = '';
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
    if (!this.validScore(score.home) || !this.validScore(score.away)) {
      this.showError('Os resultados devem ser números inteiros entre 0 e 999.');
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
