import { of, Subject } from 'rxjs';
import { ChangeDetectorRef, SimpleChange } from '@angular/core';
import { AuthenticationService } from '../../services/authethication.service';
import { CommunityTournamentsService } from '../../services/community-tournaments.service';
import { CommunityGroup } from '../model/community-group';
import { CommunityTournament, TournamentMatch, TournamentPage, TournamentParticipant, TournamentParticipantPage, TournamentTeam } from '../model/community-tournament';
import { CommunityTournamentsComponent } from './community-tournaments.component';
import { tournamentScoreTerminology } from './community-tournament-scoring';

describe('Community tournaments management', () => {
  let api: jasmine.SpyObj<CommunityTournamentsService>;
  let component: CommunityTournamentsComponent;
  const community: CommunityGroup = {
    id: 7, name: 'Liga de amigos', description: null, sport: 'Futebol', photoUrl: null,
    visibility: 'PRIVATE', rankingsEnabled: true, ownerUsername: 'owner',
    myRole: 'OWNER', memberCount: 2, createdAt: '2026-10-16T12:00:00Z', members: []
  };
  const draft: CommunityTournament = {
    id: 9, name: 'Liga', format: 'LEAGUE', status: 'DRAFT',
    winPoints: 3, drawPoints: 1, lossPoints: 0, createdAt: '2026-10-16T12:00:00Z',
    startedAt: null, completedAt: null, championProfileId: null,
    championUsername: null, championDisplayName: null, championPoints: null,
    championTied: false
  };

  beforeEach(() => {
    api = jasmine.createSpyObj<CommunityTournamentsService>('CommunityTournamentsService', [
      'list', 'create', 'participants', 'join', 'leave', 'confirm', 'removeParticipant',
      'generateSchedule', 'matches', 'recordResult', 'standings', 'complete', 'delete',
      'createTeamTournament', 'teams', 'createTeam', 'addTeamPlayer', 'removeTeamPlayer', 'deleteTeam',
      'generateTeamSchedule', 'teamMatches', 'recordTeamResult', 'teamStandings', 'completeTeam'
    ]);
    api.list.and.returnValue(of({ tournaments: [draft], page: 0, hasMore: false }));
    api.participants.and.returnValue(of({ participants: [], page: 0, hasMore: false }));
    api.matches.and.returnValue(of({ matches: [], page: 0, hasMore: false }));
    api.teams.and.returnValue(of([]));
    api.teamMatches.and.returnValue(of({ matches: [], page: 0, hasMore: false }));
    api.teamStandings.and.returnValue(of({
      tournamentId: 19, status: 'IN_PROGRESS', totalMatches: 0, completedMatches: 0,
      winPoints: 3, drawPoints: 1, lossPoints: 0, standings: []
    }));
    api.standings.and.returnValue(of({
      tournamentId: 9, status: 'DRAFT', totalMatches: 0, completedMatches: 0,
      winPoints: 3, drawPoints: 1, lossPoints: 0, standings: []
    }));
    const auth = {
      loggedInPerfilname: 'owner', isLoggedIn: () => true
    } as unknown as AuthenticationService;
    const cdr = { markForCheck: jasmine.createSpy('markForCheck') } as unknown as ChangeDetectorRef;
    component = new CommunityTournamentsComponent(api, auth, cdr);
    component.community = { ...community };
    component.ngOnChanges({ community: new SimpleChange(undefined, community, true) });
  });


  describe('real team competitions', () => {
    const teamDraft: CommunityTournament = {
      ...draft, id: 19, name: 'Torneio CNG 5x5', sport: 'Futebol',
      entryType: 'TEAM', playersPerTeam: 5
    };
    const team: TournamentTeam = {
      id: 40, name: 'Verdes', playersPerTeam: 5, createdAt: '2026-10-17T12:00:00Z', players: []
    };
    const members = [
      { profileId: 1, username: 'owner', fullName: 'Organizador', profilePicUrl: null, role: 'OWNER' as const },
      { profileId: 2, username: 'ana', fullName: 'Ana', profilePicUrl: null, role: 'MEMBER' as const },
      { profileId: 3, username: 'bruno', fullName: 'Bruno', profilePicUrl: null, role: 'MEMBER' as const }
    ];

    it('creates a team draft with independent sport and squad size', async () => {
      api.createTeamTournament.and.returnValue(of(teamDraft));
      component.startTeamCreation();
      component.nameDraft = ' Torneio CNG 5x5 ';
      component.teamSizeDraft = 5;
      await component.createTeamCompetition();
      expect(api.createTeamTournament).toHaveBeenCalledWith(7, 'Torneio CNG 5x5', 'Futebol', 5, 1, { winPoints: 3, drawPoints: 1, lossPoints: 0 }, 'GOAL_DIFFERENCE_FIRST', 'LEAGUE');
      expect(api.create).not.toHaveBeenCalled();
      expect(component.selected?.entryType).toBe('TEAM');
      expect(api.teams).toHaveBeenCalledWith(7, 19);
      expect(api.participants).toHaveBeenCalledTimes(1); // initial legacy league only
      expect(api.matches).toHaveBeenCalledTimes(1);
      expect(api.standings).toHaveBeenCalledTimes(1);
    });

    it('passes home-and-away rule at creation and resets the selection afterward', async () => {
      api.createTeamTournament.and.returnValue(of({ ...teamDraft, roundRobinLegs: 2 }));
      component.startTeamCreation();
      component.nameDraft = 'Liga casa e fora';
      component.roundRobinLegsDraft = 2;
      await component.createTeamCompetition();
      expect(api.createTeamTournament).toHaveBeenCalledWith(7, 'Liga casa e fora', 'Futebol', 5, 2, { winPoints: 3, drawPoints: 1, lossPoints: 0 }, 'GOAL_DIFFERENCE_FIRST', 'LEAGUE');
      expect(component.selected?.roundRobinLegs).toBe(2);
      expect(Number(component.roundRobinLegsDraft)).toBe(1);
      expect(api.create).not.toHaveBeenCalled();
    });

    it('stores custom team points without changing the community rankings', async () => {
      api.createTeamTournament.and.returnValue(of({
        ...teamDraft, winPoints: 2, drawPoints: 0, lossPoints: 0
      }));
      component.startTeamCreation();
      component.nameDraft = 'Torneio pontos';
      component.winPointsDraft = 2;
      component.drawPointsDraft = 0;
      component.lossPointsDraft = 0;
      await component.createTeamCompetition();
      expect(api.createTeamTournament).toHaveBeenCalledWith(
        7, 'Torneio pontos', 'Futebol', 5, 1,
        { winPoints: 2, drawPoints: 0, lossPoints: 0 }, 'GOAL_DIFFERENCE_FIRST', 'LEAGUE');
      expect(component.selected?.winPoints).toBe(2);
      expect(component.winPointsDraft).toBe(3);
      expect(component.drawPointsDraft).toBe(1);
      expect(component.lossPointsDraft).toBe(0);
      expect(api.create).not.toHaveBeenCalled();
      expect(api.standings).toHaveBeenCalledTimes(1);
    });

    it('sends the chosen team tiebreak and restores defaults after creation', async () => {
      api.createTeamTournament.and.returnValue(of({
        ...teamDraft, teamTieBreakPriority: 'WINS_FIRST'
      }));
      component.startTeamCreation();
      component.nameDraft = 'Liga de vitórias';
      component.teamTieBreakPriorityDraft = 'WINS_FIRST';
      await component.createTeamCompetition();
      expect(api.createTeamTournament).toHaveBeenCalledWith(
        7, 'Liga de vitórias', 'Futebol', 5, 1,
        { winPoints: 3, drawPoints: 1, lossPoints: 0 }, 'WINS_FIRST', 'LEAGUE');
      expect(component.selected?.teamTieBreakPriority).toBe('WINS_FIRST');
      expect(component.teamTieBreakLabel(component.selected?.teamTieBreakPriority)).toBe('Mais vitórias');
      expect(component.teamTieBreakPriorityDraft).toBe('GOAL_DIFFERENCE_FIRST');
      expect(api.create).not.toHaveBeenCalled();
    });

    it('rejects an unsupported team tiebreak before creating anything', async () => {
      component.startTeamCreation();
      component.nameDraft = 'Liga por equipas';
      component.teamTieBreakPriorityDraft = 'INVALID' as any;
      await component.createTeamCompetition();
      expect(component.error).toContain('desempate');
      expect(api.createTeamTournament).not.toHaveBeenCalled();
    });

    it('creates knockout cup without league rules or standings', async () => {
      api.createTeamTournament.and.returnValue(of({ ...teamDraft, format: 'KNOCKOUT' }));
      component.startTeamCreation();
      component.nameDraft = 'Taça entre amigos';
      component.teamFormatDraft = 'KNOCKOUT';
      component.roundRobinLegsDraft = 2;
      component.teamTieBreakPriorityDraft = 'WINS_FIRST';
      component.winPointsDraft = -1;
      await component.createTeamCompetition();
      expect(api.createTeamTournament).toHaveBeenCalledWith(
        7, 'Taça entre amigos', 'Futebol', 5, 2,
        { winPoints: -1, drawPoints: 1, lossPoints: 0 }, 'WINS_FIRST', 'KNOCKOUT');
      expect(component.selected?.format).toBe('KNOCKOUT');
      expect(component.teamFormatDraft).toBe('LEAGUE');
      expect(api.teamStandings).not.toHaveBeenCalled();
    });

    it('rejects cup draws and snapshots final winner', async () => {
      const cup = { ...teamDraft, format: 'KNOCKOUT' as const, status: 'IN_PROGRESS' as const };
      const match = { id: 65, roundNumber: 1, homeTeamId: 40, homeTeamName: 'Verdes',
        awayTeamId: 41, awayTeamName: 'Azuis', status: 'SCHEDULED' as const };
      api.teams.and.returnValue(of([team, { ...team, id: 41, name: 'Azuis' }]));
      api.teamMatches.and.returnValue(of({ matches: [match], page: 0, hasMore: false }));
      component.selectTournament(cup);
      expect(component.knockoutTotalRounds).toBe(1);
      expect(api.teamStandings).not.toHaveBeenCalled();
      component.setTeamScore(match, 'home', 1);
      component.setTeamScore(match, 'away', 1);
      await component.saveTeamScore(match);
      expect(api.recordTeamResult).not.toHaveBeenCalled();
      component.setTeamScore(match, 'away', 0);
      api.recordTeamResult.and.returnValue(of({ ...match,
        homeScore: 1, awayScore: 0, status: 'COMPLETED' as const }));
      await component.saveTeamScore(match);
      expect(component.selected?.status).toBe('COMPLETED');
      expect(component.selected?.championTeamName).toBe('Verdes');
      expect(api.teamStandings).not.toHaveBeenCalled();
    });

    it('requires the return leg before enabling team completion', () => {
      const twoLegs = { ...teamDraft, status: 'IN_PROGRESS' as const, roundRobinLegs: 2 as const };
      api.teamStandings.and.returnValue(of({
        tournamentId: 19, status: 'IN_PROGRESS', totalMatches: 2, completedMatches: 1,
        winPoints: 3, drawPoints: 1, lossPoints: 0,
        standings: [
          { position: 1, teamId: 40, teamName: 'Verdes', played: 1, won: 1,
            drawn: 0, lost: 0, goalsFor: 1, goalsAgainst: 0, goalDifference: 1, points: 3 },
          { position: 2, teamId: 41, teamName: 'Azuis', played: 1, won: 0,
            drawn: 0, lost: 1, goalsFor: 0, goalsAgainst: 1, goalDifference: -1, points: 0 }
        ]
      }));
      component.selectTournament(twoLegs);
      expect(component.canCompleteTeam).toBeFalse();
      component.teamStandings!.completedMatches = 2;
      component.teamStandings!.standings.forEach(row => row.played = 2);
      expect(component.canCompleteTeam).toBeTrue();
    });

    it('validates team size before making a request', async () => {
      component.startTeamCreation();
      component.nameDraft = 'Liga por equipas';
      component.teamSizeDraft = 31;
      await component.createTeamCompetition();
      expect(component.error).toContain('1 e 30');
      expect(api.createTeamTournament).not.toHaveBeenCalled();
      component.teamSizeDraft = 2.5;
      await component.createTeamCompetition();
      expect(api.createTeamTournament).not.toHaveBeenCalled();
    });

    it('loads only teams for team tournaments, without individual standings or fixtures', () => {
      const oldParticipantCalls = api.participants.calls.count();
      const oldMatchCalls = api.matches.calls.count();
      const oldStandingCalls = api.standings.calls.count();
      api.teams.and.returnValue(of([team]));
      component.selectTournament(teamDraft);
      expect(component.teams).toEqual([team]);
      expect(api.teams).toHaveBeenCalledWith(7, 19);
      expect(api.participants.calls.count()).toBe(oldParticipantCalls);
      expect(api.matches.calls.count()).toBe(oldMatchCalls);
      expect(api.standings.calls.count()).toBe(oldStandingCalls);
      expect(component.canPublishSchedule).toBeFalse();
    });

    it('creates teams and assigns only free community members', async () => {
      component.community = { ...community, members, memberCount: 3 };
      component.selectTournament(teamDraft);
      api.createTeam.and.returnValue(of(team));
      api.teams.and.returnValue(of([team]));
      component.teamNameDraft = '  Verdes  ';
      await component.createTournamentTeam();
      expect(api.createTeam).toHaveBeenCalledWith(7, 19, 'Verdes');
      expect(component.teams[0].name).toBe('Verdes');

      const updated = { ...team, players: [{ profileId: 2, username: 'ana', displayName: 'Ana' }] };
      api.addTeamPlayer.and.returnValue(of(updated));
      api.teams.and.returnValue(of([updated]));
      component.teamPlayerDraft[40] = 2;
      await component.assignTeamPlayer(team);
      expect(api.addTeamPlayer).toHaveBeenCalledWith(7, 19, 40, 2);
      expect(component.availableTeamMembers.map(x => x.profileId)).toEqual([1, 3]);

      component.teamPlayerDraft[40] = 2;
      await component.assignTeamPlayer(updated);
      expect(api.addTeamPlayer).toHaveBeenCalledTimes(1);
    });

    it('can remove players, then delete only an empty team', async () => {
      const occupied = { ...team, players: [{ profileId: 2, username: 'ana', displayName: 'Ana' }] };
      component.community = { ...community, members, memberCount: 3 };
      api.teams.and.returnValue(of([occupied]));
      component.selectTournament(teamDraft);
      await component.deleteTournamentTeam(occupied);
      expect(api.deleteTeam).not.toHaveBeenCalled();
      api.removeTeamPlayer.and.returnValue(of(void 0));
      api.teams.and.returnValue(of([team]));
      await component.removeTeamPlayer(occupied, 2);
      expect(api.removeTeamPlayer).not.toHaveBeenCalled();
      component.requestTeamPlayerRemoval(occupied, 2);
      await component.removeTeamPlayer(occupied, 2);
      expect(api.removeTeamPlayer).toHaveBeenCalledWith(7, 19, 40, 2);
      expect(component.pendingTeamPlayerRemoval).toBeNull();
      api.deleteTeam.and.returnValue(of(void 0));
      api.teams.and.returnValue(of([]));
      await component.deleteTournamentTeam(team);
      expect(api.deleteTeam).toHaveBeenCalledWith(7, 19, 40);
    });

    it('cancels a team player removal without mutating the roster', async () => {
      const occupied = { ...team, players: [{ profileId: 2, username: 'ana', displayName: 'Ana' }] };
      api.teams.and.returnValue(of([occupied]));
      component.selectTournament(teamDraft);
      component.requestTeamPlayerRemoval(occupied, 2);
      expect(component.pendingTeamPlayerRemoval).toEqual({ teamId: 40, profileId: 2 });
      component.cancelTeamPlayerRemoval();
      await component.removeTeamPlayer(occupied, 2);
      expect(api.removeTeamPlayer).not.toHaveBeenCalled();
    });

    it('clears a pending team player removal after switching competitions', async () => {
      const occupied = { ...team, players: [{ profileId: 2, username: 'ana', displayName: 'Ana' }] };
      api.teams.and.returnValue(of([occupied]));
      component.selectTournament(teamDraft);
      component.requestTeamPlayerRemoval(occupied, 2);
      component.selectTournament({ ...draft, id: 27 });
      expect(component.pendingTeamPlayerRemoval).toBeNull();
      await component.removeTeamPlayer(occupied, 2);
      expect(api.removeTeamPlayer).not.toHaveBeenCalled();
    });

    it('blocks duplicate removal requests for the same team player', async () => {
      const occupied = { ...team, players: [{ profileId: 2, username: 'ana', displayName: 'Ana' }] };
      api.teams.and.returnValue(of([occupied]));
      component.selectTournament(teamDraft);
      const pending = new Subject<void>();
      api.removeTeamPlayer.and.returnValue(pending);
      component.requestTeamPlayerRemoval(occupied, 2);
      const running = component.removeTeamPlayer(occupied, 2);
      await component.removeTeamPlayer(occupied, 2);
      expect(api.removeTeamPlayer).toHaveBeenCalledTimes(1);
      expect(component.busy).toBeTrue();
      pending.next();
      pending.complete();
      await running;
      expect(component.busy).toBeFalse();
      expect(component.pendingTeamPlayerRemoval).toBeNull();
    });

    it('prevents members from editing any squad', async () => {
      component.community = { ...community, myRole: 'MEMBER', members };
      component.selectTournament(teamDraft);
      component.teamNameDraft = 'Tentativa';
      component.teamPlayerDraft[40] = 2;
      await component.createTournamentTeam();
      await component.assignTeamPlayer(team);
      await component.deleteTournamentTeam(team);
      expect(api.createTeam).not.toHaveBeenCalled();
      expect(api.addTeamPlayer).not.toHaveBeenCalled();
      expect(api.deleteTeam).not.toHaveBeenCalled();
      expect(component.teams).toEqual([]);
    });

    it('ignores delayed team responses when a different competition is selected', () => {
      const delayed = new Subject<TournamentTeam[]>();
      api.teams.and.returnValue(delayed.asObservable());
      component.selectTournament(teamDraft);
      component.selectTournament(draft);
      delayed.next([team]);
      delayed.complete();
      expect(component.selected?.id).toBe(9);
      expect(component.teams).toEqual([]);
    });


    it('only enables publication when at least two teams have complete squads', () => {
      component.selectTournament(teamDraft);
      expect(component.canPublishTeamSchedule).toBeFalse();
      const complete = (id: number, name: string) => ({
        ...team, id, name, players: Array.from({ length: 5 }, (_, i) => ({
          profileId: id * 10 + i, username: 'player' + (id * 10 + i),
          displayName: 'Jogador ' + (i + 1)
        }))
      });
      component.teams = [complete(40, 'Verdes'), complete(41, 'Azuis')];
      expect(component.canPublishTeamSchedule).toBeTrue();
      component.teams[1].players.pop();
      expect(component.canPublishTeamSchedule).toBeFalse();
      component.teams[1].players.push({
        profileId: 999, username: 'extra', displayName: 'Extra'
      });
      component.community = { ...community, myRole: 'MEMBER' };
      expect(component.canPublishTeamSchedule).toBeFalse();
    });

    it('publishes real team fixtures without using the individual match endpoint', async () => {
      const competition = { ...teamDraft };
      const teamA: TournamentTeam = {
        ...team, players: Array.from({ length: 5 }, (_, i) => ({
          profileId: i + 1, username: 'green-' + i, displayName: 'Verde ' + i
        }))
      };
      const teamB: TournamentTeam = {
        ...teamA, id: 41, name: 'Azuis',
        players: teamA.players.map((p, i) => ({
          ...p, profileId: i + 20, username: 'blue-' + i
        }))
      };
      api.teams.and.returnValue(of([teamA, teamB]));
      api.generateTeamSchedule.and.returnValue(of({
        tournamentId: 19, status: 'IN_PROGRESS', teamCount: 2, roundCount: 1, matchCount: 1
      }));
      api.teamMatches.and.returnValue(of({ matches: [{
        id: 65, roundNumber: 1, homeTeamId: 40, homeTeamName: 'Verdes',
        awayTeamId: 41, awayTeamName: 'Azuis', status: 'SCHEDULED'
      }], page: 0, hasMore: false }));
      component.selectTournament(competition);
      expect(component.canPublishTeamSchedule).toBeTrue();
      component.confirmAction = 'schedule';
      await component.publishTeamSchedule();
      expect(api.generateTeamSchedule).toHaveBeenCalledWith(7, 19);
      expect(api.generateSchedule).not.toHaveBeenCalled();
      expect(component.selected?.status).toBe('IN_PROGRESS');
      expect(component.teamMatches.length).toBe(1);
      expect(component.teamMatches[0].homeTeamName).toBe('Verdes');
      expect(component.canManageTeamRoster).toBeFalse();
    });

    it('does not publish team fixtures before explicit confirmation', async () => {
      component.selectTournament(teamDraft);
      await component.publishTeamSchedule();
      expect(api.generateTeamSchedule).not.toHaveBeenCalled();
    });

    it('ignores stale fixture pages when another tournament is selected', () => {
      const loading = new Subject<any>();
      api.teams.and.returnValue(of([team]));
      api.teamMatches.and.returnValue(loading.asObservable());
      component.selectTournament({ ...teamDraft, status: 'IN_PROGRESS' });
      expect(api.teamMatches).toHaveBeenCalledWith(7, 19, 0);
      component.selectTournament(draft);
      loading.next({ matches: [{
        id: 77, roundNumber: 1, homeTeamId: 40, homeTeamName: 'A',
        awayTeamId: 41, awayTeamName: 'B', status: 'SCHEDULED'
      }], page: 0, hasMore: false });
      loading.complete();
      expect(component.teamMatches).toEqual([]);
    });

    it('allows pagination of real team fixtures', () => {
      api.teams.and.returnValue(of([team]));
      api.teamMatches.and.returnValues(
        of({ matches: [{
          id: 70, roundNumber: 1, homeTeamId: 40, homeTeamName: 'Verdes',
          awayTeamId: 41, awayTeamName: 'Azuis', status: 'SCHEDULED' as const
        }], page: 0, hasMore: true }),
        of({ matches: [{
          id: 71, roundNumber: 2, homeTeamId: 41, homeTeamName: 'Azuis',
          awayTeamId: 42, awayTeamName: 'Brancos', status: 'SCHEDULED' as const
        }], page: 1, hasMore: false })
      );
      component.selectTournament({ ...teamDraft, status: 'IN_PROGRESS' });
      expect(component.teamMatchesHasMore).toBeTrue();
      component.loadTeamMatches();
      expect(api.teamMatches).toHaveBeenCalledWith(7, 19, 1);
      expect(component.teamMatches.length).toBe(2);
      expect(component.teamMatchesHasMore).toBeFalse();
    });

    it('saves real team results and refreshes only team standings', async () => {
      const fixture = { id: 75, roundNumber: 1, homeTeamId: 40, homeTeamName: 'Azuis',
        awayTeamId: 41, awayTeamName: 'Verdes', status: 'SCHEDULED' as const,
        homeScore: null, awayScore: null };
      api.teams.and.returnValue(of([team]));
      api.teamMatches.and.returnValue(of({ matches: [fixture], page: 0, hasMore: false }));
      api.recordTeamResult.and.returnValue(of({ ...fixture, status: 'COMPLETED',
        homeScore: 2, awayScore: 1 }));
      component.selectTournament({ ...teamDraft, status: 'IN_PROGRESS' });
      component.setTeamScore(fixture, 'home', 2);
      component.setTeamScore(fixture, 'away', 1);
      const previousIndividualStandingsCalls = api.standings.calls.count();
      await component.saveTeamScore(fixture);
      expect(api.recordTeamResult).toHaveBeenCalledWith(7, 19, 75, 2, 1);
      expect(component.teamMatches[0].status).toBe('COMPLETED');
      expect(component.teamMatches[0].homeScore).toBe(2);
      expect(api.teamStandings).toHaveBeenCalledWith(7, 19);
      expect(api.standings.calls.count()).toBe(previousIndividualStandingsCalls);
      expect(api.recordResult).not.toHaveBeenCalled();
    });

    it('only enables team closing once every real fixture is scored', async () => {
      api.teams.and.returnValue(of([team, { ...team, id: 41, name: 'Azuis' }]));
      api.teamStandings.and.returnValue(of({
        tournamentId: 19, status: 'IN_PROGRESS', totalMatches: 1, completedMatches: 0,
        winPoints: 3, drawPoints: 1, lossPoints: 0,
        standings: [
          { position: 1, teamId: 40, teamName: 'Verdes', played: 0, won: 0,
            drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0 },
          { position: 2, teamId: 41, teamName: 'Azuis', played: 0, won: 0,
            drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, goalDifference: 0, points: 0 }
        ]
      }));
      component.selectTournament({ ...teamDraft, status: 'IN_PROGRESS' });
      expect(component.canCompleteTeam).toBeFalse();
      const table = component.teamStandings!;
      table.completedMatches = 1;
      table.standings.forEach(row => row.played = 1);
      expect(component.canCompleteTeam).toBeTrue();
      component.confirmAction = 'completeTeam';
      api.completeTeam.and.returnValue(of({ ...teamDraft, status: 'COMPLETED',
        championTeamId: 40, championTeamName: 'Verdes', championPoints: 3,
        completedAt: '2026-10-17T12:00:00Z' }));
      await component.completeTeam();
      expect(api.completeTeam).toHaveBeenCalledWith(7, 19);
      expect(api.complete).not.toHaveBeenCalled();
      expect(component.selected?.championTeamName).toBe('Verdes');
      expect(component.selected?.status).toBe('COMPLETED');
      expect(component.canCompleteTeam).toBeFalse();
    });

    it('respects the module switch for team competition creation', () => {
      component.community = { ...community, teamTournamentsEnabled: false };
      component.startTeamCreation();
      expect(component.showTeamCreate).toBeFalse();
      expect(api.createTeamTournament).not.toHaveBeenCalled();
    });
  });

  it('loads tournament list, roster, fixtures and standings for the selected community', () => {
    expect(api.list).toHaveBeenCalledWith(7, 0);
    expect(api.participants).toHaveBeenCalledWith(7, 9, 0);
    expect(api.matches).toHaveBeenCalledWith(7, 9, 0);
    expect(api.standings).toHaveBeenCalledWith(7, 9);
    expect(component.selected?.id).toBe(9);
  });

  it('only shows organizer actions to owner/admin', () => {
    expect(component.canManage).toBeTrue();
    component.community = { ...community, myRole: 'MEMBER' };
    expect(component.canManage).toBeFalse();
  });

  it('creates a tournament, chooses it and reloads its details', async () => {
    const created = { ...draft, id: 12, name: 'Liga de Inverno' };
    api.create.and.returnValue(of(created));
    component.startIndividualCreation();
    component.nameDraft = ' Liga de Inverno ';
    await component.create();
    expect(api.create).toHaveBeenCalledWith(7, 'Liga de Inverno', 'Futebol', { winPoints: 3, drawPoints: 1, lossPoints: 0 });
    expect(component.selected?.id).toBe(12);
    expect(component.tournaments[0].id).toBe(12);
  });


  it('sends custom points on individual creation and resets after success', async () => {
    api.create.and.returnValue(of({ ...draft, id: 14,
      winPoints: 5, drawPoints: 2, lossPoints: 0 }));
    component.startIndividualCreation();
    component.nameDraft = 'Liga personalizada';
    component.winPointsDraft = 5;
    component.drawPointsDraft = 2;
    await component.create();
    expect(api.create).toHaveBeenCalledWith(7, 'Liga personalizada', 'Futebol',
      { winPoints: 5, drawPoints: 2, lossPoints: 0 });
    expect(component.selected?.winPoints).toBe(5);
    expect(component.winPointsDraft).toBe(3);
    expect(component.drawPointsDraft).toBe(1);
  });

  it('rejects negative, fractional and excessive points without sending a request', async () => {
    component.startIndividualCreation();
    component.nameDraft = 'Liga incompleta';
    component.winPointsDraft = -1;
    expect(component.validPointRules).toBeFalse();
    await component.create();
    expect(api.create).not.toHaveBeenCalled();
    expect(component.error).toContain('pontos inteiros');
    component.winPointsDraft = 2.5;
    expect(component.validPointRules).toBeFalse();
    component.winPointsDraft = 101;
    expect(component.validPointRules).toBeFalse();
    component.winPointsDraft = 0;
    component.drawPointsDraft = 0;
    component.lossPointsDraft = 0;
    expect(component.validPointRules).toBeTrue();
  });

  it('requires a sport when a community has several before a tournament can be created', async () => {
    api.list.and.returnValue(of({ tournaments: [], page: 0, hasMore: false }));
    component.community = { ...community, sports: ['Futebol', 'Padel'] };
    component.ngOnChanges({ community: new SimpleChange(community, component.community, false) });
    expect(component.sportDraft).toBe('');
    component.startIndividualCreation();
    component.nameDraft = 'Liga de outono';
    await component.create();
    expect(api.create).not.toHaveBeenCalled();
    expect(component.error).toContain('modalidade');

    component.chooseSport('Padel');
    api.create.and.returnValue(of({ ...draft, id: 14, sport: 'Padel' }));
    await component.create();
    expect(api.create).toHaveBeenCalledWith(7, 'Liga de outono', 'Padel', { winPoints: 3, drawPoints: 1, lossPoints: 0 });
  });

  it('supports a tournament sport outside the community without changing it', async () => {
    component.community = { ...community, sports: ['Futebol', 'Padel'] };
    component.ngOnChanges({ community: new SimpleChange(community, component.community, false) });
    component.sportSearch = 'natação';
    expect(component.suggestedSports).toContain('Natação');
    component.chooseSport('Natação');
    component.startIndividualCreation();
    component.nameDraft = 'Liga de natação';
    api.create.and.returnValue(of({ ...draft, id: 22, sport: 'Natação' }));
    await component.create();
    expect(api.create).toHaveBeenCalledWith(7, 'Liga de natação', 'Natação', { winPoints: 3, drawPoints: 1, lossPoints: 0 });
    expect(component.scoring.scoreInput).toBe('Marcador de');
    expect(component.community.sport).toBe('Futebol');
  });

  it('keeps legacy community modalities selectable even if they are outside the catalog', async () => {
    component.community = { ...community, sports: ['Desporto local tradicional', 'Futebol'] };
    component.ngOnChanges({ community: new SimpleChange(community, component.community, false) });
    component.sportSearch = 'tradicional';
    expect(component.suggestedSports).toContain('Desporto local tradicional');
    component.chooseSport('Desporto local tradicional');
    component.startIndividualCreation();
    component.nameDraft = 'Torneio local';
    api.create.and.returnValue(of({ ...draft, id: 23, sport: 'Desporto local tradicional' }));
    await component.create();
    expect(api.create).toHaveBeenCalledWith(7, 'Torneio local', 'Desporto local tradicional', { winPoints: 3, drawPoints: 1, lossPoints: 0 });
  });

  it('uses the selected tournament sport for scoring rather than the community primary sport', () => {
    component.selected = { ...draft, sport: 'Padel' };
    expect(component.scoring.scoreInput).toContain('Sets');
    component.selected = { ...draft, sport: 'Basquetebol' };
    expect(component.scoring.scoreInput).toContain('Pontos');
    component.selected = { ...draft, sport: null };
    expect(component.scoring.scoreInput).toContain('Marcador');
  });


  it('shows onboarding for an empty community and leaves team creation unavailable', () => {
    api.list.and.returnValue(of({ tournaments: [], page: 0, hasMore: false }));
    component.ngOnChanges({ community: new SimpleChange(community, community, false) });
    expect(component.showGuide).toBeTrue();
    expect(component.showIndividualCreate).toBeFalse();
    expect(api.create).not.toHaveBeenCalled();
  });

  it('removes the selected trial only after explicit confirmation and resets the view', async () => {
    api.delete.and.returnValue(of(void 0));
    api.list.and.returnValue(of({ tournaments: [], page: 0, hasMore: false }));
    component.confirmAction = 'delete';
    await component.deleteSelected();
    expect(api.delete).toHaveBeenCalledWith(7, 9);
    expect(component.selected).toBeUndefined();
    expect(component.tournaments).toEqual([]);
    expect(component.feedback).toBe('Competição eliminada.');
  });

  it('does not delete without confirmation or management rights', async () => {
    await component.deleteSelected();
    expect(api.delete).not.toHaveBeenCalled();
    component.confirmAction = 'delete';
    component.community = { ...community, myRole: 'MEMBER' };
    await component.deleteSelected();
    expect(api.delete).not.toHaveBeenCalled();
  });

  it('enrolls only the current player and requests updated roster', async () => {
    const entry = {
      profileId: 4, username: 'owner', displayName: 'Owner',
      status: 'PENDING' as const, joinedAt: '2026-10-16T12:01:00Z'
    };
    api.join.and.returnValue(of(entry));
    api.participants.and.returnValue(of({ participants: [entry], page: 0, hasMore: false }));
    await component.join();
    expect(api.join).toHaveBeenCalledWith(7, 9);
    expect(component.myEnrollment?.status).toBe('PENDING');
  });

  it('does not publish a schedule without explicit confirmation', async () => {
    api.generateSchedule.and.returnValue(of({
      tournamentId: 9, participantCount: 2, matchCount: 1, roundCount: 1, status: 'IN_PROGRESS'
    }));
    component.rosterReady = true;
    component.participants = [1, 2].map(id => ({
      profileId: id, username: 'p' + id, displayName: 'Jogador ' + id,
      status: 'CONFIRMED' as const, joinedAt: '2026-10-16T12:00:00Z'
    }));
    await component.publishSchedule();
    expect(api.generateSchedule).not.toHaveBeenCalled();
    component.confirmAction = 'schedule';
    await component.publishSchedule();
    expect(api.generateSchedule).toHaveBeenCalledWith(7, 9);
    expect(component.selected?.status).toBe('IN_PROGRESS');
  });

  it('rejects invalid results before issuing an HTTP request', async () => {
    component.selected = { ...draft, status: 'IN_PROGRESS' };
    const game: TournamentMatch = {
      id: 22, roundNumber: 1, homeProfileId: 1, homeUsername: 'ana',
      awayProfileId: 2, awayUsername: 'rui', status: 'SCHEDULED',
      homeScore: null, awayScore: null
    };
    component.setScore(game, 'home', -1);
    component.setScore(game, 'away', 1);
    await component.saveScore(game);
    expect(api.recordResult).not.toHaveBeenCalled();
    expect(component.error).toContain('0 e 999');
  });

  it('does not close an unfinished tournament', async () => {
    component.selected = { ...draft, status: 'IN_PROGRESS' };
    component.confirmAction = 'complete';
    await component.complete();
    expect(api.complete).not.toHaveBeenCalled();
  });

  it('resets data when navigating between communities', () => {
    api.list.and.returnValue(of({ tournaments: [], page: 0, hasMore: false }));
    component.community = { ...community, id: 10, name: 'Outra equipa' };
    component.ngOnChanges({ community: new SimpleChange(community, component.community, false) });
    expect(api.list).toHaveBeenCalledWith(10, 0);
    expect(component.selected).toBeUndefined();
    expect(component.participants.length).toBe(0);
  });
  it('allows public tournament previews without requesting private rosters or standings', () => {
    api.participants.calls.reset();
    api.matches.calls.reset();
    api.standings.calls.reset();
    component.community = { ...community, id: 8, myRole: null, visibility: 'PUBLIC' };
    component.ngOnChanges({ community: new SimpleChange(community, component.community, false) });

    expect(component.selected?.id).toBe(9);
    expect(component.isMember).toBeFalse();
    expect(component.canManage).toBeFalse();
    expect(api.list).toHaveBeenCalledWith(8, 0);
    expect(api.participants).not.toHaveBeenCalled();
    expect(api.matches).not.toHaveBeenCalled();
    expect(api.standings).not.toHaveBeenCalled();
    expect(component.error).toBe('');
  });

  it('requires a full round-robin calendar and one game per player before enabling completion', () => {
    component.selected = { ...draft, status: 'IN_PROGRESS' };
    component.standings = {
      tournamentId: 9, status: 'IN_PROGRESS', totalMatches: 2, completedMatches: 2,
      winPoints: 3, drawPoints: 1, lossPoints: 0,
      standings: [1, 2, 3].map(id => ({
        position: id, profileId: id, username: 'p' + id, displayName: 'Player ' + id,
        played: 2, won: 1, drawn: 0, lost: 1, goalsFor: 1, goalsAgainst: 1,
        goalDifference: 0, points: 3
      }))
    };
    expect(component.canComplete).toBeFalse();
    component.standings.totalMatches = 3;
    component.standings.completedMatches = 3;
    expect(component.canComplete).toBeTrue();
    component.standings.standings[0].played = 1;
    expect(component.canComplete).toBeFalse();
  });

  it('does not suggest another registration when the roster is not fully loaded', async () => {
    component.participantsHasMore = true;
    expect(component.myEnrollment).toBeUndefined();
    await component.join();
    expect(api.join).not.toHaveBeenCalled();
  });

  it('ignores a previous community list response after switching communities', () => {
    const oldResponse = new Subject<TournamentPage>();
    api.list.and.returnValue(oldResponse);
    component.community = { ...community, id: 11 };
    component.ngOnChanges({ community: new SimpleChange(community, component.community, false) });
    api.list.and.returnValue(of({ tournaments: [], page: 0, hasMore: false }));
    component.community = { ...community, id: 12 };
    component.ngOnChanges({ community: new SimpleChange(community, component.community, false) });

    oldResponse.next({ tournaments: [draft], page: 0, hasMore: false });
    oldResponse.complete();

    expect(component.selected).toBeUndefined();
    expect(component.tournaments).toEqual([]);
    expect(component.loading).toBeFalse();
    expect(api.list).toHaveBeenCalledWith(12, 0);
  });

  it('keeps previously loaded fixture pages after saving a result and refreshes standings', async () => {
    const match: TournamentMatch = {
      id: 84, roundNumber: 9, homeProfileId: 1, homeUsername: 'ana',
      awayProfileId: 2, awayUsername: 'rui', status: 'SCHEDULED',
      homeScore: null, awayScore: null
    };
    component.selected = { ...draft, status: 'IN_PROGRESS' };
    component.matches = [match];
    component.matchesPage = 3;
    component.matchesHasMore = true;
    component.setScore(match, 'home', 2);
    component.setScore(match, 'away', 1);
    api.recordResult.and.returnValue(of({
      ...match, status: 'COMPLETED', homeScore: 2, awayScore: 1
    }));
    api.participants.calls.reset();
    api.matches.calls.reset();
    api.standings.calls.reset();

    await component.saveScore(match);

    expect(api.recordResult).toHaveBeenCalledWith(7, 9, 84, 2, 1);
    expect(component.matchesPage).toBe(3);
    expect(component.matchesHasMore).toBeTrue();
    expect(component.matches.length).toBe(1);
    expect(component.matches[0].status).toBe('COMPLETED');
    expect(component.scoreDraft(match)).toEqual({ home: 2, away: 1 });
    expect(api.matches).not.toHaveBeenCalled();
    expect(api.participants).not.toHaveBeenCalled();
    expect(api.standings).toHaveBeenCalledWith(7, 9);
  });

  it('requires explicit confirmation before removing a tournament participant', async () => {
    const person: TournamentParticipant = {
      profileId: 4, username: 'pedro', displayName: 'Pedro',
      joinedAt: '2026-10-16T12:00:00Z', status: 'CONFIRMED'
    };
    component.participants = [person];
    api.removeParticipant.and.returnValue(of(void 0));
    await component.remove(person);
    expect(api.removeParticipant).not.toHaveBeenCalled();
    component.requestParticipantRemoval(person);
    expect(component.pendingParticipantRemovalId).toBe(4);
    await component.remove(person);
    expect(api.removeParticipant).toHaveBeenCalledOnceWith(7, 9, 4);
    expect(component.pendingParticipantRemovalId).toBeNull();
  });

  it('allows cancellation and clears confirmation on tournament switch', async () => {
    const person: TournamentParticipant = {
      profileId: 4, username: 'pedro', displayName: 'Pedro',
      joinedAt: '2026-10-16T12:00:00Z', status: 'CONFIRMED'
    };
    component.participants = [person];
    component.requestParticipantRemoval(person);
    component.cancelParticipantRemoval();
    await component.remove(person);
    expect(api.removeParticipant).not.toHaveBeenCalled();
    component.requestParticipantRemoval(person);
    component.selectTournament({ ...draft, id: 21 });
    expect(component.pendingParticipantRemovalId).toBeNull();
    await component.remove(person);
    expect(api.removeParticipant).not.toHaveBeenCalled();
  });

  it('blocks duplicate confirmation while a removal request is pending', async () => {
    const person: TournamentParticipant = {
      profileId: 4, username: 'pedro', displayName: 'Pedro',
      joinedAt: '2026-10-16T12:00:00Z', status: 'CONFIRMED'
    };
    component.participants = [person];
    const pending = new Subject<void>();
    api.removeParticipant.and.returnValue(pending);
    component.requestParticipantRemoval(person);
    const running = component.remove(person);
    await component.remove(person);
    expect(api.removeParticipant).toHaveBeenCalledTimes(1);
    expect(component.busy).toBeTrue();
    pending.next();
    pending.complete();
    await running;
    expect(component.busy).toBeFalse();
    expect(component.pendingParticipantRemovalId).toBeNull();
  });

  it('releases the busy state on tournament switch while an old participants page is loading', () => {
    const pendingPage = new Subject<TournamentParticipantPage>();
    api.participants.and.returnValue(pendingPage);
    component.participantsHasMore = true;
    component.loadMoreParticipants();
    expect(component.busy).toBeTrue();

    api.participants.and.returnValue(of({ participants: [], page: 0, hasMore: false }));
    component.selectTournament({ ...draft, id: 21, name: 'Outra liga' });
    expect(component.busy).toBeFalse();
    expect(component.selected?.id).toBe(21);

    pendingPage.next({
      participants: [{ profileId: 100, username: 'stale', displayName: 'Antigo',
        joinedAt: '2026-10-16T12:00:00Z', status: 'CONFIRMED' }],
      page: 1, hasMore: false
    });
    pendingPage.complete();
    expect(component.participants).toEqual([]);
    expect(component.busy).toBeFalse();
    expect(component.error).toBe('');
  });

  it('discards a previous tournament mutation error after selecting a different tournament', async () => {
    const pendingJoin = new Subject<TournamentParticipant>();
    api.join.and.returnValue(pendingJoin);
    const joining = component.join();
    expect(component.busy).toBeTrue();

    component.selectTournament({ ...draft, id: 22, name: 'Liga nova' });
    expect(component.busy).toBeFalse();
    pendingJoin.error(new Error('A operação anterior falhou'));
    await joining;

    expect(component.selected?.id).toBe(22);
    expect(component.error).toBe('');
    expect(component.feedback).toBe('');
    expect(component.busy).toBeFalse();
  });

  it('ignores a stale success even if the user returns to the same tournament', async () => {
    const pendingJoin = new Subject<TournamentParticipant>();
    api.join.and.returnValue(pendingJoin);
    const joining = component.join();

    component.selectTournament({ ...draft, id: 25 });
    component.selectTournament({ ...draft });
    pendingJoin.next({
      profileId: 1, username: 'owner', displayName: 'Owner',
      joinedAt: '2026-10-16T12:00:00Z', status: 'PENDING'
    });
    pendingJoin.complete();
    await joining;

    expect(component.selected?.id).toBe(9);
    expect(component.feedback).toBe('');
    expect(component.error).toBe('');
    expect(component.busy).toBeFalse();
  });

  it('rejects one-character tournament names before calling the API', async () => {
    component.nameDraft = ' A ';
    expect(component.nameTooShort).toBeTrue();
    await component.create();
    expect(api.create).not.toHaveBeenCalled();
    expect(component.error).toContain('2 e 120');
    component.nameDraft = 'Liga';
    expect(component.nameTooShort).toBeFalse();
  });

  it('shows marker validation only after the match inputs are touched', () => {
    const game: TournamentMatch = {
      id: 50, roundNumber: 1, homeProfileId: 1, homeUsername: 'owner',
      awayProfileId: 2, awayUsername: 'rui', status: 'SCHEDULED',
      homeScore: null, awayScore: null
    };
    expect(component.isScoreInvalid(game)).toBeFalse();
    component.setScore(game, 'home', -1);
    expect(component.isScoreInvalid(game)).toBeTrue();
    component.setScore(game, 'home', 2);
    component.setScore(game, 'away', 1);
    expect(component.isScoreInvalid(game)).toBeFalse();
  });

  it('blocks scheduling while the roster has more pages or detail did not load', async () => {
    component.participants = [1, 2].map(id => ({
      profileId: id, username: 'p' + id, displayName: 'Jogador ' + id,
      status: 'CONFIRMED' as const, joinedAt: '2026-10-16T12:00:00Z'
    }));
    component.confirmAction = 'schedule';
    component.rosterReady = false;
    expect(component.canPublishSchedule).toBeFalse();
    await component.publishSchedule();
    expect(api.generateSchedule).not.toHaveBeenCalled();

    component.rosterReady = true;
    component.participantsHasMore = true;
    expect(component.canPublishSchedule).toBeFalse();
    await component.publishSchedule();
    expect(api.generateSchedule).not.toHaveBeenCalled();

    component.participantsHasMore = false;
    expect(component.canPublishSchedule).toBeTrue();
  });

  it('refuses scheduling with more than 32 confirmed players', async () => {
    component.rosterReady = true;
    component.participants = Array.from({ length: 33 }, (_, i) => ({
      profileId: i + 1, username: 'p' + (i + 1), displayName: 'Jogador ' + (i + 1),
      status: 'CONFIRMED' as const, joinedAt: '2026-10-16T12:00:00Z'
    }));
    component.confirmAction = 'schedule';
    expect(component.confirmedCount).toBe(33);
    expect(component.canPublishSchedule).toBeFalse();
    await component.publishSchedule();
    expect(api.generateSchedule).not.toHaveBeenCalled();
  });

  it('shows goal terminology only for goal-based sports', () => {
    expect(tournamentScoreTerminology('Futebol').scoreInput).toBe('Golos de');
    expect(tournamentScoreTerminology('Andebol').forAbbrev).toBe('GM');
    expect(tournamentScoreTerminology('Futsal').differenceTitle).toBe('Diferença de golos');
  });

  it('uses points for basketball, rugby and American football instead of goals', () => {
    expect(tournamentScoreTerminology('Basquetebol').scoreInput).toBe('Pontos de');
    expect(tournamentScoreTerminology('Basquetebol 3x3').forAbbrev).toBe('PM');
    expect(tournamentScoreTerminology('Rugby').againstTitle).toBe('Pontos sofridos');
    expect(tournamentScoreTerminology('Futebol Americano').forAbbrev).toBe('PM');
    component.community = { ...community, sport: 'Futebol' };
    component.selected = { ...draft, sport: 'Basquetebol' };
    expect(component.scoring.scoreInput).toBe('Pontos de');
  });

  it('uses sets terminology without implying full per-set scoring or pairs', () => {
    for (const sport of ['Pádel', 'Ténis', 'Voleibol', 'Badminton', 'Ténis de mesa']) {
      const terms = tournamentScoreTerminology(sport);
      expect(terms.scoreInput).toBe('Sets ganhos de');
      expect(terms.differenceAbbrev).toBe('DS');
      expect(terms.note).toContain('Não regista o resultado de cada set');
    }
  });

  it('does not call unknown sports football by default', () => {
    for (const sport of [null, 'Ciclismo', 'Natação', 'Atletismo']) {
      const terms = tournamentScoreTerminology(sport);
      expect(terms.scoreInput).toBe('Marcador de');
      expect(terms.forAbbrev).toBe('MF');
      expect(terms.note).toContain('não suporta pares');
    }
  });

});
