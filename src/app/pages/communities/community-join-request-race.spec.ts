import { of, Subject } from 'rxjs';
import { CommunitiesComponent } from './communities.component';
import { CommunityGroup } from '../model/community-group';

describe('Community join request race protection', () => {
  let component: CommunitiesComponent;
  let api: any;

  const presentation = (id = 42) => ({
    id, name: 'Futsal', visibility: 'PRIVATE'
  });

  beforeEach(() => {
    component = Object.create(CommunitiesComponent.prototype) as CommunitiesComponent;
    component.communityPresentation = presentation() as any;
    component.membershipActionLoading = false;
    component.joinRequestSent = false;
    component.pendingJoinLookupLoading = false;
    component.membershipActionMessage = '';
    component.errorMessage = '';
    component.pendingJoinRequests = [];
    component.pendingJoinRequestsLoading = false;
    component.selectedJoinRequestIds = new Set<number>();
    component.confirmingBatchJoin = false;
    component.batchJoining = false;
    (component as any).pendingJoinLookupVersion = 0;
    (component as any).pendingRequestsLookupVersion = 0;
    api = {
      myPendingJoinRequest: jasmine.createSpy('myPendingJoinRequest'),
      requestJoin: jasmine.createSpy('requestJoin').and.returnValue(of({})),
      pendingJoinRequests: jasmine.createSpy('pendingJoinRequests'),
      acceptJoinRequest: jasmine.createSpy('acceptJoinRequest').and.returnValue(of({})),
      rejectJoinRequest: jasmine.createSpy('rejectJoinRequest').and.returnValue(of({}))
    };
    (component as any).communityService = api;
  });

  it('disables joining while checking whether the private request is already pending', () => {
    const pendingGet = new Subject<any>();
    api.myPendingJoinRequest.and.returnValue(pendingGet.asObservable());

    (component as any).loadMyPendingJoinRequest(42);
    expect(component.pendingJoinLookupLoading).toBeTrue();
    component.joinPresentedCommunity();
    expect(api.requestJoin).not.toHaveBeenCalled();

    pendingGet.next(null);
    pendingGet.complete();
    expect(component.pendingJoinLookupLoading).toBeFalse();
    component.joinPresentedCommunity();
    expect(api.requestJoin).toHaveBeenCalledWith(42);
    expect(component.joinRequestSent).toBeTrue();
  });

  it('ignores an older pending lookup after joining was submitted', () => {
    const old = new Subject<any>();
    api.myPendingJoinRequest.and.returnValue(old.asObservable());
    (component as any).loadMyPendingJoinRequest(42);

    // A fresh check supersedes the first request; only the newest one can update UI.
    const newer = new Subject<any>();
    api.myPendingJoinRequest.and.returnValue(newer.asObservable());
    (component as any).loadMyPendingJoinRequest(42);
    newer.next(null);
    newer.complete();
    component.joinPresentedCommunity();
    expect(component.joinRequestSent).toBeTrue();

    old.next(null);
    old.complete();
    expect(component.joinRequestSent).toBeTrue();
    expect(component.membershipActionMessage).toBeTruthy();
  });

  it('ignores an old lookup failure after a newer successful join', () => {
    const old = new Subject<any>();
    api.myPendingJoinRequest.and.returnValue(old.asObservable());
    (component as any).loadMyPendingJoinRequest(42);
    const newer = new Subject<any>();
    api.myPendingJoinRequest.and.returnValue(newer.asObservable());
    (component as any).loadMyPendingJoinRequest(42);
    newer.next(null);
    newer.complete();
    component.joinPresentedCommunity();
    old.error(new Error('slow timeout'));
    expect(component.joinRequestSent).toBeTrue();
    expect(component.membershipActionMessage).toBeTruthy();
  });

  it('does not resurrect approved requests when a stale list arrives', () => {
    const staleList = new Subject<any[]>();
    const request = { id: 91, requesterUsername: 'ana' };
    component.selected = { id: 42, myRole: 'OWNER' } as CommunityGroup;
    component.pendingJoinRequests = [request as any];
    api.pendingJoinRequests.and.returnValue(staleList.asObservable());
    spyOn<any>(component, 'refreshSelected');
    (component as any).loadPendingJoinRequests(42);
    component.acceptPendingJoinRequest(request as any);
    expect(component.pendingJoinRequests).toEqual([]);
    staleList.next([request]);
    staleList.complete();
    expect(component.pendingJoinRequests).toEqual([]);
    expect(component.pendingJoinRequestsLoading).toBeFalse();
  });

  it('does not resurrect rejected requests when an older list arrives', () => {
    const staleList = new Subject<any[]>();
    const request = { id: 91, requesterUsername: 'ana' };
    component.selected = { id: 42, myRole: 'OWNER' } as CommunityGroup;
    component.pendingJoinRequests = [request as any];
    api.pendingJoinRequests.and.returnValue(staleList.asObservable());
    (component as any).loadPendingJoinRequests(42);
    component.rejectPendingJoinRequest(request as any);
    staleList.next([request]);
    staleList.complete();
    expect(component.pendingJoinRequests).toEqual([]);
  });

  it('only applies the latest manager request list', () => {
    component.selected = { id: 42, myRole: 'ADMIN' } as CommunityGroup;
    const first = new Subject<any[]>();
    const second = new Subject<any[]>();
    api.pendingJoinRequests.and.returnValues(first.asObservable(), second.asObservable());
    (component as any).loadPendingJoinRequests(42);
    (component as any).loadPendingJoinRequests(42);
    second.next([{ id: 92 }]);
    second.complete();
    first.next([{ id: 91 }]);
    first.complete();
    expect(component.pendingJoinRequests.map(r => r.id)).toEqual([92]);
    expect(component.pendingJoinRequestsLoading).toBeFalse();
  });
});
