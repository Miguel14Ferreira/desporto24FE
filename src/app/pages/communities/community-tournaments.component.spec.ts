import { of, Subject } from 'rxjs';
import { ChangeDetectorRef, SimpleChange } from '@angular/core';
import { AuthenticationService } from '../../services/authethication.service';
import { CommunityTournamentsService } from '../../services/community-tournaments.service';
import { CommunityGroup } from '../model/community-group';
import { CommunityTournament, TournamentMatch, TournamentPage, TournamentParticipant, TournamentParticipantPage } from '../model/community-tournament';
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
      'generateSchedule', 'matches', 'recordResult', 'standings', 'complete'
    ]);
    api.list.and.returnValue(of({ tournaments: [draft], page: 0, hasMore: false }));
    api.participants.and.returnValue(of({ participants: [], page: 0, hasMore: false }));
    api.matches.and.returnValue(of({ matches: [], page: 0, hasMore: false }));
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
    component.nameDraft = ' Liga de Inverno ';
    await component.create();
    expect(api.create).toHaveBeenCalledWith(7, 'Liga de Inverno');
    expect(component.selected?.id).toBe(12);
    expect(component.tournaments[0].id).toBe(12);
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
    component.community = { ...community, sport: 'Basquetebol' };
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
