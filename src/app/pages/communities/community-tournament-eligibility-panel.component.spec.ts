import { of, Subject, throwError } from 'rxjs';
import { CommunityGroup } from '../model/community-group';
import { CommunityTournamentEligibilityPanelComponent } from './community-tournament-eligibility-panel.component';
import { CommunityTournamentEligibilityService } from '../../services/community-tournament-eligibility.service';

describe('Tournament eligibility panel', () => {
  const community = {
    id: 7, myRole: 'ADMIN',
    members: [{ profileId: 11, username: 'ana', fullName: 'Ana Silva', role: 'MEMBER' }]
  } as CommunityGroup;
  const api = jasmine.createSpyObj<CommunityTournamentEligibilityService>(
    'CommunityTournamentEligibilityService', ['overview']);
  const detector = jasmine.createSpyObj('ChangeDetectorRef', ['markForCheck']);
  let component: CommunityTournamentEligibilityPanelComponent;

  beforeEach(() => {
    api.overview.and.returnValue(of({
      tournamentId: 19, entryType: 'TEAM', checkedAt: '2026-11-06T16:00:00Z',
      ineligibleEntries: [{ profileId: 11, teamId: 8, participantStatus: null,
        suspendedUntil: '2026-11-09T16:00:00Z' }]
    }));
    api.overview.calls.reset();
    component = new CommunityTournamentEligibilityPanelComponent(api, detector);
    component.community = community;
    component.tournamentId = 19;
  });

  it('loads a scoped report for organizers, including previously enrolled players', () => {
    component.reload();
    expect(api.overview).toHaveBeenCalledOnceWith(7, 19);
    expect(component.overview?.ineligibleEntries[0].profileId).toBe(11);
    expect(component.overview?.ineligibleEntries[0].teamId).toBe(8);
    expect(component.memberName(11)).toBe('Ana Silva');
  });

  it('does not fetch private eligibility when the viewer is an ordinary member', () => {
    component.community = { ...community, myRole: 'MEMBER' };
    component.reload();
    expect(api.overview).not.toHaveBeenCalled();
    expect(component.overview).toBeNull();
  });

  it('cancels the previous report when switching tournaments', () => {
    const pending = new Subject<ReturnType<typeof api.overview> extends import('rxjs').Observable<infer T> ? T : never>();
    api.overview.and.returnValue(pending);
    component.reload();
    expect(pending.observed).toBeTrue();
    component.tournamentId = 20;
    api.overview.and.returnValue(of({
      tournamentId: 20, entryType: 'INDIVIDUAL', checkedAt: '2026-11-06T17:00:00Z',
      ineligibleEntries: []
    }));
    component.reload();
    expect(pending.observed).toBeFalse();
    expect(component.overview?.tournamentId).toBe(20);
  });

  it('cancels private report access after organizer permissions are revoked', () => {
    const pending = new Subject<ReturnType<typeof api.overview> extends import('rxjs').Observable<infer T> ? T : never>();
    api.overview.and.returnValue(pending);
    component.reload();
    expect(pending.observed).toBeTrue();
    component.community = {...community, myRole: 'MEMBER'};
    component.reload();
    expect(pending.observed).toBeFalse();
    expect(component.overview).toBeNull();
    expect(component.loading).toBeFalse();
  });

  it('cancels outstanding requests when the panel is destroyed', () => {
    const pending = new Subject<ReturnType<typeof api.overview> extends import('rxjs').Observable<infer T> ? T : never>();
    api.overview.and.returnValue(pending);
    component.reload();
    component.ngOnDestroy();
    expect(pending.observed).toBeFalse();
    component.reload();
    expect(api.overview).toHaveBeenCalledTimes(1);
  });

  it('does not expose another tournament report on failed refresh', () => {
    component.reload();
    api.overview.and.returnValue(throwError(() => new Error('forbidden')));
    component.tournamentId = 20;
    component.reload();
    expect(api.overview).toHaveBeenCalledWith(7, 20);
    expect(component.overview).toBeNull();
    expect(component.error).toContain('Não foi possível');
    expect(component.loading).toBeFalse();
  });
});
