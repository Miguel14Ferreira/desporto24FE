import { of, throwError } from 'rxjs';
import { CommunityGroup } from '../model/community-group';
import { CommunityDisciplinePanelComponent } from './community-discipline-panel.component';
import { CommunityDisciplineService } from '../../services/community-discipline.service';

describe('Community discipline panel', () => {
  const community = {
    id: 7,
    members: [
      { profileId: 10, username: 'owner', fullName: 'Owner', role: 'OWNER' },
      { profileId: 11, username: 'member', fullName: 'Membro', role: 'MEMBER' },
      { profileId: 12, username: 'admin', fullName: 'Admin', role: 'ADMIN' }
    ]
  } as CommunityGroup;

  const api = jasmine.createSpyObj<CommunityDisciplineService>(
    'CommunityDisciplineService', ['mine', 'list', 'warn']);
  const changeDetector = jasmine.createSpyObj('ChangeDetectorRef', ['markForCheck']);
  let component: CommunityDisciplinePanelComponent;

  beforeEach(() => {
    api.mine.and.returnValue(of([]));
    api.list.and.returnValue(of([]));
    api.warn.and.returnValue(of({
      id: 42, communityId: 7, targetProfileId: 11, issuedByProfileId: 10,
      reason: 'Comportamento incorreto', createdAt: '2026-11-06T12:00:00Z'
    }));
    component = new CommunityDisciplinePanelComponent(api, changeDetector);
    component.community = community;
    component.canManage = true;
    api.mine.calls.reset();
    api.list.calls.reset();
    api.warn.calls.reset();
  });

  it('only offers ordinary members as warning targets', () => {
    expect(component.eligibleMembers.map(item => item.profileId)).toEqual([11]);
  });

  it('loads manager history scoped to the selected community', () => {
    component.load();
    expect(api.list).toHaveBeenCalledWith(7);
    expect(api.mine).not.toHaveBeenCalled();
    expect(component.loading).toBeFalse();
  });

  it('ordinary members can only see their own warning history', () => {
    component.canManage = false;
    component.load();
    expect(api.mine).toHaveBeenCalledWith(7);
    expect(api.list).not.toHaveBeenCalled();
    component.targetProfileId = 11;
    component.reason = 'Exemplo';
    component.issueWarning();
    expect(api.warn).not.toHaveBeenCalled();
  });

  it('prevents issuing warnings without a valid target or reason', () => {
    component.targetProfileId = 12;
    component.reason = 'Exemplo';
    component.issueWarning();
    component.targetProfileId = 11;
    component.reason = ' ';
    component.issueWarning();
    expect(api.warn).not.toHaveBeenCalled();
  });

  it('posts an ordinary member warning then refreshes the list', () => {
    component.targetProfileId = 11;
    component.reason = '  Comportamento incorreto  ';
    component.issueWarning();
    expect(api.warn).toHaveBeenCalledWith(7, 11, 'Comportamento incorreto');
    expect(component.feedback).toBe('Advertência registada na comunidade.');
    expect(component.reason).toBe('');
    expect(api.list).toHaveBeenCalledWith(7);
  });

  it('shows errors when the server refuses a warning without claiming success', () => {
    api.warn.and.returnValue(throwError(() => new Error('forbidden')));
    component.targetProfileId = 11;
    component.reason = 'Exemplo';
    component.issueWarning();
    expect(component.error).toContain('Não foi possível');
    expect(component.feedback).toBe('');
    expect(component.saving).toBeFalse();
  });
});
