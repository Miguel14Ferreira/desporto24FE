import { of } from 'rxjs';
import { convertToParamMap } from '@angular/router';
import { CommunitiesComponent } from './communities.component';
import { CommunityGroup } from '../model/community-group';

describe('Community join request deep links', () => {
  let component: CommunitiesComponent;
  let getCommunity: jasmine.Spy;
  let pendingJoinRequests: jasmine.Spy;
  let myHistoricalClaims: jasmine.Spy;

  beforeEach(() => {
    component = Object.create(CommunitiesComponent.prototype) as CommunitiesComponent;
    component.isDetailMode = true;
    component.selectedJoinRequestIds = new Set<number>();
    getCommunity = jasmine.createSpy('get').and.returnValue(of({
      id: 42, myRole: 'OWNER', members: [], rankingsEnabled: false
    } as unknown as CommunityGroup));
    pendingJoinRequests = jasmine.createSpy('pendingJoinRequests').and.returnValue(of([]));
    myHistoricalClaims = jasmine.createSpy('myHistoricalClaims').and.returnValue(of([]));
    (component as any).communityService = {
      get: getCommunity, pendingJoinRequests,
      listHistoricalStandings: () => of([]),
      listHistoricalMatches: () => of([]),
      myHistoricalClaims,
      historicalPlayerCandidates: () => of([])
    };
    (component as any).route = {
      snapshot: { queryParamMap: convertToParamMap({ tab: 'members' }) }
    };
    spyOn<any>(component, 'prepareRoundEntries');
    spyOn<any>(component, 'loadCompetition');
    spyOn<any>(component, 'loadCommunitySessions');
  });

  it('opens member management and loads pending requests for the owner', () => {
    component.open({ id: 42 } as CommunityGroup);
    expect(getCommunity).toHaveBeenCalledWith(42);
    expect(component.activeTab).toBe('members');
    expect(pendingJoinRequests).toHaveBeenCalledWith(42);
  });

  it('also allows admins to open the join request management tab', () => {
    getCommunity.and.returnValue(of({
      id: 42, myRole: 'ADMIN', members: []
    } as unknown as CommunityGroup));
    component.open({ id: 42 } as CommunityGroup);
    expect(component.activeTab).toBe('members');
    expect(pendingJoinRequests).toHaveBeenCalledWith(42);
  });

  it('opens identity self-service for ordinary members without exposing manager join requests', () => {
    getCommunity.and.returnValue(of({
      id: 42, myRole: 'MEMBER', members: []
    } as unknown as CommunityGroup));
    component.open({ id: 42 } as CommunityGroup);
    expect(component.activeTab).toBe('members');
    expect(myHistoricalClaims).toHaveBeenCalledWith(42);
    expect(pendingJoinRequests).not.toHaveBeenCalled();
  });
});
