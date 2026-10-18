import { of, Subject, throwError } from 'rxjs';
import { CommunitiesComponent } from './communities.component';
import { CommunityGroup } from '../model/community-group';

describe('Community ownership transfer confirmation and reconciliation', () => {
  const makeGroup = (role: 'OWNER' | 'ADMIN' = 'OWNER'): CommunityGroup => ({
    id: 19, name: 'Grupo da Vila', description: 'Jogos',
    sport: 'Futebol', photoUrl: null, visibility: 'PRIVATE',
    rankingsEnabled: false, ownerUsername: 'dona', myRole: role,
    createdAt: '2026-10-18T12:00:00Z', memberCount: 3,
    members: [
      { profileId: 1, username: 'dona', fullName: 'Dona', profilePicUrl: null, role: 'OWNER' },
      { profileId: 2, username: 'ana', fullName: 'Ana', profilePicUrl: null, role: 'ADMIN' },
      { profileId: 3, username: 'joao', fullName: 'João', profilePicUrl: null, role: 'MEMBER' }
    ]
  });

  const transferred = (group: CommunityGroup): CommunityGroup => ({
    ...group, ownerUsername: 'ana', myRole: 'ADMIN',
    members: group.members.map(m =>
      m.username === 'ana' ? { ...m, role: 'OWNER' as const }
      : m.username === 'dona' ? { ...m, role: 'ADMIN' as const } : m)
  });

  function setup(role: 'OWNER' | 'ADMIN' = 'OWNER') {
    const group = makeGroup(role);
    const page = Object.create(CommunitiesComponent.prototype) as CommunitiesComponent;
    const api = {
      transferOwnership: jasmine.createSpy('transferOwnership').and.returnValue(of(transferred(group))),
      get: jasmine.createSpy('get').and.returnValue(of(group))
    };
    page.selected = group;
    page.communities = [group];
    page.ownershipUsername = 'ana';
    page.ownershipConfirmation = null;
    page.ownershipActionLoading = false;
    page.ownershipOutcomeUnknown = null;
    page.ownershipVerificationLoading = false;
    page.ownershipFeedback = '';
    page.memberAction = null;
    page.memberRemovalOutcomeUnknown = null;
    page.memberRemovalVerificationLoading = false;
    page.errorMessage = '';
    (page as any).communityService = api;
    return { group, page, api };
  }

  it('refuses unconfirmed transfer, invalid recipient and non-owner permissions', () => {
    const { page, api } = setup();
    page.transferOwnership();
    expect(api.transferOwnership).not.toHaveBeenCalled();

    page.ownershipUsername = 'not-a-member';
    page.requestOwnershipTransfer();
    expect(page.ownershipConfirmation).toBeNull();
    expect(page.ownershipFeedback).toContain('Seleciona');

    page.ownershipUsername = 'dona';
    page.requestOwnershipTransfer();
    expect(page.ownershipConfirmation).toBeNull();

    page.ownershipUsername = 'ana';
    page.requestOwnershipTransfer();
    expect(page.ownershipConfirmation).toEqual(jasmine.objectContaining({
      communityId: 19, username: 'ana', previousOwner: 'dona'
    }));
    page.onOwnershipCandidateChange();
    expect(page.ownershipConfirmation).toBeNull();
    page.requestOwnershipTransfer();
    page.cancelOwnershipTransfer();
    expect(page.ownershipConfirmation).toBeNull();

    page.selected = makeGroup('ADMIN');
    page.requestOwnershipTransfer();
    page.transferOwnership();
    expect(api.transferOwnership).not.toHaveBeenCalled();
  });

  it('sends one confirmed PUT and applies the resulting admin permissions', () => {
    const { page, group, api } = setup();
    const pending = new Subject<CommunityGroup>();
    api.transferOwnership.and.returnValue(pending.asObservable());

    page.requestOwnershipTransfer();
    page.transferOwnership();
    page.transferOwnership();
    page.requestOwnershipTransfer();
    expect(api.transferOwnership).toHaveBeenCalledOnceWith(19, 'ana');
    expect(page.ownershipActionLoading).toBeTrue();

    pending.next(transferred(group));
    pending.complete();
    expect(page.ownershipActionLoading).toBeFalse();
    expect(page.selected?.ownerUsername).toBe('ana');
    expect(page.selected?.myRole).toBe('ADMIN');
    expect(page.communities[0].ownerUsername).toBe('ana');
    expect(page.ownershipUsername).toBe('');
    expect(page.ownershipConfirmation).toBeNull();
  });

  it('reconciles a timed-out transfer with GET without retrying the PUT', () => {
    const { page, group, api } = setup();
    api.transferOwnership.and.returnValue(throwError(() => ({ status: 504 })));
    api.get.and.returnValue(of(transferred(group)));

    page.requestOwnershipTransfer();
    page.transferOwnership();
    expect(api.transferOwnership).toHaveBeenCalledOnceWith(19, 'ana');
    expect(api.get).toHaveBeenCalledOnceWith(19);
    expect(page.ownershipOutcomeUnknown).toBeNull();
    expect(page.selected?.myRole).toBe('ADMIN');
    expect(page.ownershipConfirmation).toBeNull();
    page.transferOwnership();
    expect(api.transferOwnership).toHaveBeenCalledTimes(1);
  });

  it('blocks another transfer after GET failure and permits a new explicit confirmation only if still owner', () => {
    const { page, group, api } = setup();
    api.transferOwnership.and.returnValues(
      throwError(() => ({ name: 'TimeoutError' })), of(transferred(group))
    );
    api.get.and.returnValues(throwError(() => ({ status: 503 })), of(group));

    page.requestOwnershipTransfer();
    page.transferOwnership();
    expect(page.ownershipOutcomeUnknown).toEqual(jasmine.objectContaining({
      communityId: 19, username: 'ana'
    }));
    expect(page.ownershipFeedback).toContain('Não foi possível confirmar');
    page.transferOwnership();
    page.cancelOwnershipTransfer();
    expect(api.transferOwnership).toHaveBeenCalledTimes(1);
    expect(page.ownershipConfirmation).not.toBeNull();

    page.verifyOwnershipTransfer();
    expect(api.get).toHaveBeenCalledTimes(2);
    expect(page.ownershipOutcomeUnknown).toBeNull();
    expect(page.ownershipFeedback).toContain('Continuas proprietário');
    expect(page.ownershipConfirmation).not.toBeNull();
    expect(api.transferOwnership).toHaveBeenCalledTimes(1);

    page.transferOwnership();
    expect(api.transferOwnership).toHaveBeenCalledTimes(2);
    expect(page.selected?.myRole).toBe('ADMIN');
  });

  it('does not retry if the current owner changed to a different member', () => {
    const { page, group, api } = setup();
    const different = {
      ...group, ownerUsername: 'joao', myRole: 'ADMIN' as const,
      members: group.members.map(m =>
        m.username === 'dona' ? { ...m, role: 'ADMIN' as const }
        : m.username === 'joao' ? { ...m, role: 'OWNER' as const } : m)
    };
    api.transferOwnership.and.returnValue(throwError(() => ({ status: 503 })));
    api.get.and.returnValue(of(different));
    page.requestOwnershipTransfer();
    page.transferOwnership();
    expect(page.ownershipConfirmation).toBeNull();
    expect(page.ownershipUsername).toBe('');
    expect(page.selected?.ownerUsername).toBe('joao');
    page.transferOwnership();
    expect(api.transferOwnership).toHaveBeenCalledTimes(1);
  });

  it('ignores confirmation received after switching to another community', () => {
    const { page, api } = setup();
    const pending = new Subject<CommunityGroup>();
    api.transferOwnership.and.returnValue(pending.asObservable());
    page.requestOwnershipTransfer();
    page.transferOwnership();
    const other = { ...makeGroup(), id: 20, name: 'Outro grupo' };
    page.selected = other;
    page.communities = [other];
    pending.next(transferred(makeGroup()));
    pending.complete();
    expect(page.selected?.id).toBe(20);
    expect(page.communities[0].id).toBe(20);
  });
});
