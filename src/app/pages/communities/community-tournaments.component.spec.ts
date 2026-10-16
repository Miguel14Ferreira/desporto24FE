import { of, Subject } from 'rxjs';
import { SimpleChange } from '@angular/core';
import { AuthenticationService } from '../../services/authethication.service';
import { CommunityTournamentsService } from '../../services/community-tournaments.service';
import { CommunityGroup } from '../model/community-group';
import { CommunityTournament, TournamentMatch, TournamentPage } from '../model/community-tournament';
import { CommunityTournamentsComponent } from './community-tournaments.component';

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
    component = new CommunityTournamentsComponent(api, auth);
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

});
