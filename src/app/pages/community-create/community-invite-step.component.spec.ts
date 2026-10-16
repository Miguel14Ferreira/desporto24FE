import { of, throwError } from 'rxjs';
import { CommunityInviteStepComponent } from './community-invite-step.component';
import { CommunityGroup } from '../model/community-group';

describe('CommunityInviteStepComponent', () => {
  let previousLanguage: string | null;
  beforeEach(() => {
    previousLanguage = localStorage.getItem('d24-language');
    localStorage.setItem('d24-language', 'pt');
  });
  afterEach(() => {
    if (previousLanguage === null) localStorage.removeItem('d24-language');
    else localStorage.setItem('d24-language', previousLanguage);
  });

  function setup(role: 'OWNER' | 'ADMIN' | 'MEMBER' = 'OWNER', visibility: 'PRIVATE' | 'PUBLIC' = 'PRIVATE') {
    const community = { id: 42, name: 'Futebol das Quintas', sport: 'Futebol',
      myRole: role, visibility } as CommunityGroup;
    const route = { snapshot: { paramMap: { get: () => '42' } } };
    const groups = { get: jasmine.createSpy('get').and.returnValue(of(community)) };
    const router = { navigate: jasmine.createSpy('navigate').and.resolveTo(true) };
    const component = new CommunityInviteStepComponent(route as any, groups as any, router as any);
    component.ngOnInit();
    return { component, groups, router };
  }

  it('prepares a link to the community after an explicit click', () => {
    const { component } = setup();
    expect(component.inviteLink).toBe('');
    component.generateLink();
    expect(component.inviteLink).toBe(window.location.origin + '/menu/communities/42');
    expect(decodeURIComponent(component.whatsAppShareUrl())).toContain('/menu/communities/42');
  });

  it('does not let ordinary members generate invitation links on this screen', () => {
    const { component } = setup('MEMBER');
    component.generateLink();
    expect(component.inviteLink).toBe('');
    expect(component.whatsAppShareUrl()).toBe('');
  });

  it('uses join-request wording for private groups', () => {
    const { component } = setup('OWNER', 'PRIVATE');
    component.generateLink();
    expect(decodeURIComponent(component.whatsAppShareUrl())).toContain('pede adesão');
  });

  it('continues to the new community even when its details could not be loaded', () => {
    const { component, groups, router } = setup();
    groups.get.and.returnValue(throwError(() => new Error('unavailable')));
    component.ngOnInit();
    expect(component.loadError).toBeTrue();
    component.continueToCommunity();
    expect(router.navigate).toHaveBeenCalledWith(['/menu/communities', 42]);
  });
});
