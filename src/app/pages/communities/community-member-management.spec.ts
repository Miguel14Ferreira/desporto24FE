import { of, Subject, throwError } from 'rxjs';
import { CommunitiesComponent } from './communities.component';
import { CommunityGroup } from '../model/community-group';

describe('Community member management permissions and confirmations', () => {
  const baseGroup = (myRole: 'OWNER' | 'ADMIN' | 'MEMBER'): CommunityGroup => ({
    id: 19,
    name: 'Grupo da Vila',
    description: 'Jogos de futebol',
    sport: 'Futebol',
    photoUrl: null,
    visibility: 'PRIVATE',
    rankingsEnabled: false,
    ownerUsername: 'dona',
    myRole,
    memberCount: 3,
    createdAt: '2026-10-18T12:00:00Z',
    members: [
      { profileId: 1, username: 'dona', fullName: 'Dona', profilePicUrl: null, role: 'OWNER' },
      { profileId: 2, username: 'ana', fullName: 'Ana', profilePicUrl: null, role: 'ADMIN' },
      { profileId: 3, username: 'joao', fullName: 'João', profilePicUrl: null, role: 'MEMBER' }
    ]
  });

  function setup(myRole: 'OWNER' | 'ADMIN' | 'MEMBER' = 'OWNER') {
    const page = Object.create(CommunitiesComponent.prototype) as CommunitiesComponent;
    const group = baseGroup(myRole);
    const api = {
      updateRole: jasmine.createSpy('updateRole').and.returnValue(of(group)),
      removeMember: jasmine.createSpy('removeMember').and.returnValue(of(void 0))
    };
    page.selected = group;
    page.communities = [group];
    page.memberAction = null;
    page.memberRemovalConfirmation = null;
    page.errorMessage = '';
    (page as any).communityService = api;
    spyOn(page, 'prepareRoundEntries');
    return { page, group, api };
  }

  it('does not dispatch role changes by admins or ordinary members, or for the owner', () => {
    const { page, api } = setup('ADMIN');
    page.setRole('joao', 'ADMIN');
    page.setRole('ana', 'MEMBER');
    page.requestMemberRemoval('ana');
    expect(api.updateRole).not.toHaveBeenCalled();
    expect(page.memberRemovalConfirmation).toBeNull();
    expect(page.canRemoveMember('ana')).toBeFalse();
    expect(page.canRemoveMember('dona')).toBeFalse();
    expect(page.canRemoveMember('joao')).toBeTrue();

    page.selected = baseGroup('MEMBER');
    page.requestMemberRemoval('joao');
    page.removeMember('joao');
    page.setRole('joao', 'ADMIN');
    expect(api.updateRole).not.toHaveBeenCalled();
    expect(api.removeMember).not.toHaveBeenCalled();

    page.selected = baseGroup('OWNER');
    page.setRole('dona', 'ADMIN');
    page.setRole('joao', 'MEMBER');
    page.requestMemberRemoval('dona');
    expect(api.updateRole).not.toHaveBeenCalled();
    expect(page.memberRemovalConfirmation).toBeNull();
  });

  it('requires confirmation and supports cancel without calling the delete endpoint', () => {
    const { page, api } = setup();
    page.removeMember('joao');
    expect(api.removeMember).not.toHaveBeenCalled();

    page.requestMemberRemoval('joao');
    expect(page.memberRemovalConfirmation).toEqual({ communityId: 19, username: 'joao' });
    page.cancelMemberRemoval();
    expect(page.memberRemovalConfirmation).toBeNull();
    page.removeMember('joao');
    expect(api.removeMember).not.toHaveBeenCalled();
  });

  it('dispatches a single confirmed removal and updates members after DELETE succeeds', () => {
    const { page, api } = setup();
    const pending = new Subject<void>();
    api.removeMember.and.returnValue(pending.asObservable());

    page.requestMemberRemoval('joao');
    page.removeMember('joao');
    page.removeMember('joao');
    page.requestMemberRemoval('ana');

    expect(api.removeMember).toHaveBeenCalledOnceWith(19, 'joao');
    expect(page.memberAction).toEqual(jasmine.objectContaining({ username: 'joao', kind: 'remove' }));
    expect(page.memberRemovalConfirmation?.username).toBe('joao');

    pending.next();
    pending.complete();

    expect(page.memberAction).toBeNull();
    expect(page.memberRemovalConfirmation).toBeNull();
    expect(page.selected?.memberCount).toBe(2);
    expect(page.selected?.members.map(m => m.username)).toEqual(['dona', 'ana']);
    expect(page.communities[0].members.map(m => m.username)).toEqual(['dona', 'ana']);
  });

  it('blocks overlapping promotions and ignores role responses for a different community', () => {
    const { page, group, api } = setup();
    const pending = new Subject<CommunityGroup>();
    api.updateRole.and.returnValue(pending.asObservable());

    page.setRole('joao', 'ADMIN');
    page.setRole('ana', 'MEMBER');
    page.requestMemberRemoval('joao');
    expect(api.updateRole).toHaveBeenCalledOnceWith(19, 'joao', 'ADMIN');
    expect(page.memberAction?.kind).toBe('role');
    expect(page.memberRemovalConfirmation).toBeNull();

    // Navigation may select another community before the request completes.
    const different = { ...group, id: 20, name: 'Outra comunidade' };
    page.selected = different;
    page.communities = [different];
    pending.next({
      ...group,
      members: group.members.map(m => m.username === 'joao' ? { ...m, role: 'ADMIN' as const } : m)
    });
    pending.complete();

    expect(page.memberAction).toBeNull();
    expect(page.selected?.id).toBe(20);
    expect(page.communities[0].id).toBe(20);
    expect(page.prepareRoundEntries).not.toHaveBeenCalled();
  });

  it('keeps the confirmation available after a definitive remove failure', () => {
    const { page, api } = setup();
    api.removeMember.and.returnValues(
      throwError(() => ({ status: 403 })),
      of(void 0)
    );
    page.requestMemberRemoval('joao');
    page.removeMember('joao');
    expect(page.memberAction).toBeNull();
    expect(page.memberRemovalConfirmation?.username).toBe('joao');
    expect(page.errorMessage).toBeTruthy();
    expect(page.selected?.memberCount).toBe(3);

    page.removeMember('joao');
    expect(api.removeMember).toHaveBeenCalledTimes(2);
    expect(page.memberRemovalConfirmation).toBeNull();
    expect(page.selected?.memberCount).toBe(2);
  });
});
