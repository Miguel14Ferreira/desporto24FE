import { of, throwError } from 'rxjs';
import { CommunitiesComponent } from './communities.component';
import { CommunityGroup } from '../model/community-group';
import { CommunityJoinRequest } from '../../services/community-groups.service';

describe('CommunitiesComponent bulk community approvals', () => {
  let component: CommunitiesComponent;
  let approve: jasmine.Spy;

  beforeEach(() => {
    component = Object.create(CommunitiesComponent.prototype) as CommunitiesComponent;
    component.selected = { id: 12, myRole: 'OWNER' } as CommunityGroup;
    component.pendingJoinRequests = [1, 2, 3].map(id => ({
      id, communityId: 12, communityName: 'Futsal', requesterUsername: 'player' + id,
      status: 'PENDING', createdAt: ''
    })) as CommunityJoinRequest[];
    component.selectedJoinRequestIds = new Set<number>();
    component.confirmingBatchJoin = false;
    component.batchJoining = false;
    component.batchJoinTotal = 0;
    component.batchJoinProcessed = 0;
    component.batchJoinFeedback = '';
    component.joinRequestActionId = undefined;
    approve = jasmine.createSpy('acceptJoinRequest').and.returnValue(of({}));
    (component as any).communityService = { acceptJoinRequest: approve };
    spyOn(component, 'canManage').and.returnValue(true);
    spyOn<any>(component, 'refreshSelected');
  });

  it('approves only selected people after explicit confirmation', async () => {
    component.selectJoinRequest(1, true);
    component.selectJoinRequest(3, true);
    component.beginBatchApproval();
    expect(approve).not.toHaveBeenCalled();

    await component.confirmBatchApproval();

    expect(approve.calls.allArgs()).toEqual([[12, 1], [12, 3]]);
    expect(component.pendingJoinRequests.map(request => request.id)).toEqual([2]);
    expect(component.batchJoinProcessed).toBe(2);
    expect(component.batchJoining).toBeFalse();
    expect((component as any).refreshSelected).toHaveBeenCalledTimes(1);
  });

  it('keeps failed approvals pending for a retry', async () => {
    approve.and.callFake((_communityId: number, id: number) =>
      id === 3 ? throwError(() => new Error('failed')) : of({}));
    component.selectJoinRequest(1, true);
    component.selectJoinRequest(3, true);
    component.beginBatchApproval();

    await component.confirmBatchApproval();

    expect(component.pendingJoinRequests.map(request => request.id)).toEqual([2, 3]);
    expect(component.selectedJoinRequestIds.has(3)).toBeTrue();
    expect(component.batchJoinFeedback).toBeTruthy();
    expect(component.batchJoining).toBeFalse();
  });

  it('refuses to approve without confirmation or manager permission', async () => {
    component.toggleAllJoinRequests();
    await component.confirmBatchApproval();
    expect(approve).not.toHaveBeenCalled();

    (component.canManage as jasmine.Spy).and.returnValue(false);
    component.beginBatchApproval();
    expect(component.confirmingBatchJoin).toBeFalse();
  });

  it('cancels confirmation when the selection changes', () => {
    component.selectJoinRequest(1, true);
    component.beginBatchApproval();
    component.selectJoinRequest(2, true);
    expect(component.confirmingBatchJoin).toBeFalse();
  });
});
