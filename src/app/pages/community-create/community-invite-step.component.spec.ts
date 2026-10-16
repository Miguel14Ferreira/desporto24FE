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

  it('asks about competitions after inviting without updating settings', () => {
    const { component, router } = setup();
    component.continueAfterInvite();
    expect(component.step).toBe('competition');
    expect(component.competitionChoice).toBeNull();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('enables competition only after a positive explicit choice', () => {
    const { component, router } = setup();
    const update = jasmine.createSpy('updateCompetitionSettings')
      .and.returnValue(of({ rankingsEnabled: true }));
    (component as any).groups.updateCompetitionSettings = update;

    component.continueAfterInvite();
    component.selectCompetition(true);
    component.saveCompetitionAndContinue();

    expect(update).toHaveBeenCalledWith(42, {
      rankingsEnabled: true,
      winPoints: null,
      drawPoints: null,
      lossPoints: null
    });
    expect(router.navigate).toHaveBeenCalledWith(['/menu/communities', 42]);
    expect(component.competitionSaving).toBeFalse();
  });

  it('supports disabling the rankings module explicitly', () => {
    const { component, router } = setup();
    const update = jasmine.createSpy('updateCompetitionSettings')
      .and.returnValue(of({ rankingsEnabled: false }));
    (component as any).groups.updateCompetitionSettings = update;
    component.continueAfterInvite();
    component.selectCompetition(false);
    component.saveCompetitionAndContinue();

    expect(update).toHaveBeenCalledWith(42, {
      rankingsEnabled: false,
      winPoints: null,
      drawPoints: null,
      lossPoints: null
    });
    expect(router.navigate).toHaveBeenCalled();
  });

  it('does not save without choosing an option', () => {
    const { component, router } = setup();
    const update = jasmine.createSpy('updateCompetitionSettings');
    (component as any).groups.updateCompetitionSettings = update;
    component.continueAfterInvite();
    component.saveCompetitionAndContinue();
    expect(update).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('does not let ordinary members configure competition', () => {
    const { component, router } = setup('MEMBER');
    component.selectCompetition(true);
    expect(component.competitionChoice).toBeNull();
    component.continueAfterInvite();
    expect(component.step).toBe('invite');
    expect(router.navigate).toHaveBeenCalledWith(['/menu/communities', 42]);
  });

  it('shows errors on failed saving and supports retrying', () => {
    const { component, router } = setup();
    const update = jasmine.createSpy('updateCompetitionSettings')
      .and.returnValue(throwError(() => new Error('network')));
    (component as any).groups.updateCompetitionSettings = update;
    component.continueAfterInvite();
    component.selectCompetition(true);
    component.saveCompetitionAndContinue();

    expect(router.navigate).not.toHaveBeenCalled();
    expect(component.competitionError).toBeTruthy();
    expect(component.competitionSaving).toBeFalse();
    expect(component.step).toBe('competition');

    update.and.returnValue(of({ rankingsEnabled: true }));
    component.saveCompetitionAndContinue();
    expect(router.navigate).toHaveBeenCalledWith(['/menu/communities', 42]);
  });

  it('lets people decide later without changing settings', () => {
    const { component, router } = setup();
    const update = jasmine.createSpy('updateCompetitionSettings');
    (component as any).groups.updateCompetitionSettings = update;
    component.continueAfterInvite();
    component.continueToCommunity();
    expect(update).not.toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/menu/communities', 42]);
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
