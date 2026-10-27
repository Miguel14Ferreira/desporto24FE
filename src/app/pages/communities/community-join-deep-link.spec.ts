import { of, Subject } from 'rxjs';
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
    component.open({ id: 42 } as unknown as CommunityGroup);
    expect(getCommunity).toHaveBeenCalledWith(42);
    expect(component.activeTab).toBe('members');
    expect(pendingJoinRequests).toHaveBeenCalledWith(42);
    expect(myHistoricalClaims).not.toHaveBeenCalled();
  });

  it('also allows admins to open the join request management tab', () => {
    getCommunity.and.returnValue(of({
      id: 42, myRole: 'ADMIN', members: []
    } as unknown as CommunityGroup));
    component.open({ id: 42 } as unknown as CommunityGroup);
    expect(component.activeTab).toBe('members');
    expect(pendingJoinRequests).toHaveBeenCalledWith(42);
  });

  it('ignores a slow earlier community response after navigating to another community', () => {
    const first = new Subject<CommunityGroup>();
    const second = new Subject<CommunityGroup>();
    getCommunity.and.returnValues(first.asObservable(), second.asObservable());

    component.open({ id: 42 } as unknown as CommunityGroup);
    component.open({ id: 43 } as unknown as CommunityGroup);

    second.next({ id: 43, myRole: 'MEMBER', members: [], rankingsEnabled: true } as unknown as CommunityGroup);
    expect(component.selected?.id).toBe(43);
    expect(component.activeTab).toBe('members');
    first.next({ id: 42, myRole: 'OWNER', members: [], rankingsEnabled: true } as unknown as CommunityGroup);
    expect(component.selected?.id).toBe(43);
    expect(pendingJoinRequests).not.toHaveBeenCalled();
  });

  it('ignores errors from older community requests after newer ones succeed', () => {
    const first = new Subject<CommunityGroup>();
    const second = new Subject<CommunityGroup>();
    getCommunity.and.returnValues(first.asObservable(), second.asObservable());

    component.open({ id: 42 } as unknown as CommunityGroup);
    component.open({ id: 43 } as unknown as CommunityGroup);
    second.next({ id: 43, myRole: 'MEMBER', members: [] } as unknown as CommunityGroup);
    first.error(new Error('Request superseded'));
    expect(component.selected?.id).toBe(43);
    expect(component.errorMessage).toBe('');
  });

  it('resolves an archive-only history deep link once the saved archives load', () => {
    const archiveList = new Subject<any[]>();
    getCommunity.and.returnValue(of({
      id: 42, myRole: 'MEMBER', members: [], rankingsEnabled: false,
      individualTournamentsEnabled: false, teamTournamentsEnabled: false
    } as unknown as CommunityGroup));
    (component as any).route = {
      snapshot: { queryParamMap: convertToParamMap({ tab: 'ranking' }) }
    };
    (component as any).communityService.listHistoricalStandings = () => archiveList.asObservable();

    component.open({ id: 42 } as unknown as CommunityGroup);
    expect(component.activeTab).toBe('home');
    archiveList.next([{ id: 15, title: 'Época antiga' }]);
    expect(component.activeTab).toBe('ranking');
  });

  it('does not override manual navigation when a deferred archive deep link finishes', () => {
    const archiveList = new Subject<any[]>();
    getCommunity.and.returnValue(of({
      id: 42, myRole: 'MEMBER', members: [], rankingsEnabled: false,
      individualTournamentsEnabled: false, teamTournamentsEnabled: false
    } as unknown as CommunityGroup));
    (component as any).route = {
      snapshot: { queryParamMap: convertToParamMap({ tab: 'ranking' }) }
    };
    (component as any).communityService.listHistoricalStandings = () => archiveList.asObservable();

    component.open({ id: 42 } as unknown as CommunityGroup);
    component.setTab('members');
    archiveList.next([{ id: 15, title: 'Época antiga' }]);
    expect(component.activeTab).toBe('members');
  });

  it('opens member tab for ordinary members without loading the retired identity card or manager requests', () => {
    getCommunity.and.returnValue(of({
      id: 42, myRole: 'MEMBER', members: []
    } as unknown as CommunityGroup));
    component.open({ id: 42 } as unknown as CommunityGroup);
    expect(component.activeTab).toBe('members');
    expect(myHistoricalClaims).not.toHaveBeenCalled();
    expect(pendingJoinRequests).not.toHaveBeenCalled();
  });
});
