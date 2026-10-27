import { of, throwError } from 'rxjs';
import { CommunitiesComponent } from './communities.component';
import { SessionSummary } from '../model/session-summary';

describe('Community sessions: quick competition results', () => {
  let component: CommunitiesComponent;
  let save: jasmine.Spy;
  let reload: jasmine.Spy;
  const session: SessionSummary = {
    id: 63, sport: 'Futebol', city: 'Lisboa',
    gameDate: '2026-10-20T21:00:00Z',
    participantCount: 2, maxParticipants: 10, priceAmount: 0,
    status: 'COMPLETED', privateGame: true, distanceKm: null
  };
  beforeEach(() => {
    component = Object.create(CommunitiesComponent.prototype) as CommunitiesComponent;
    component.selected = { id: 8 } as any;
    component.selectedSeasonId = 6;
    component.competition = { settings: { rankingsEnabled: true } } as any;
    component.recordedCommunitySessionIds = new Set<number>();
    (component as any).sessionResultRevision = 0;
    component.sessionResultLoading = false;
    component.sessionResultSaving = false;
    component.sessionResultWinner = '';
    component.sessionResultPlayers = [];
    component.sessionResultError = '';
    component.sessionResultSuccess = '';
    spyOn(component, 'canManage').and.returnValue(true);
    reload = spyOn(component, 'loadCompetition');
    save = jasmine.createSpy('recordSessionResult').and.returnValue(of({}));
    (component as any).communityService = {
      recordSessionResult: save,
      recordedSessionResults: jasmine.createSpy('recordedSessionResults').and.returnValue(of([])),
      sessionResultRoster: jasmine.createSpy('sessionResultRoster').and.returnValue(of([
        { id: 1, username: 'ana', teamCode: 'A', attendanceStatus: 'ATTENDED' },
        { id: 2, username: 'bea', teamCode: 'B', attendanceStatus: 'ATTENDED' },
        { id: 3, username: 'carlos', teamCode: 'A', attendanceStatus: 'NO_SHOW' }
      ]))
    };
  });

  it('only offers quick results when community standings are enabled and game already happened', () => {
    expect(component.canRecordCommunitySession(session)).toBeTrue();
    component.competition = { settings: { rankingsEnabled: false } } as any;
    expect(component.canRecordCommunitySession(session)).toBeFalse();
    component.competition = { settings: { rankingsEnabled: true } } as any;
    expect(component.canRecordCommunitySession({ ...session, status: 'CANCELLED' })).toBeFalse();
    expect(component.canRecordCommunitySession({
      ...session, gameDate: '2100-01-01T20:00:00Z'
    })).toBeFalse();
  });

  it('loads confirmed and pending participants and excludes no-shows', () => {
    component.openCommunitySessionResult(session);
    expect(component.sessionResultPlayers.map(p => p.username)).toEqual(['ana', 'bea']);
    expect(component.sessionResultPlayers.map(p => p.team)).toEqual(['A', 'B']);
    expect(component.sessionResultLoading).toBeFalse();
  });

  it('requires two teams and an explicit winner/draw, then refreshes the classification', () => {
    component.openCommunitySessionResult(session);
    component.confirmCommunitySessionResult();
    expect(save).not.toHaveBeenCalled();
    component.sessionResultWinner = 'A';
    expect(component.canConfirmCommunitySessionResult).toBeTrue();
    component.confirmCommunitySessionResult();
    expect(save).toHaveBeenCalledOnceWith(8, 63, {
      outcome: 'A',
      players: [{ username: 'ana', team: 'A' }, { username: 'bea', team: 'B' }]
    });
    expect(component.recordedCommunitySessionIds.has(63)).toBeTrue();
    expect(component.sessionResultSession).toBeUndefined();
    expect(reload).toHaveBeenCalledWith(component.selected, 6);
  });

  it('blocks duplicate sessions already recorded by another organizer', () => {
    component.recordedCommunitySessionIds = new Set([63]);
    component.openCommunitySessionResult(session);
    expect(component.sessionResultSession).toBeUndefined();
    expect(save).not.toHaveBeenCalled();
  });

  it('shows server conflicts without counting a duplicate locally', () => {
    save.and.returnValue(throwError(() => ({ status: 409 })));
    component.openCommunitySessionResult(session);
    component.sessionResultWinner = 'DRAW';
    component.confirmCommunitySessionResult();
    expect(component.sessionResultError).toBeTruthy();
    expect(component.recordedCommunitySessionIds.has(63)).toBeFalse();
    expect(reload).not.toHaveBeenCalled();
  });
});
