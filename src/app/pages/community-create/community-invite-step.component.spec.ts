import { of, throwError } from 'rxjs';
import { appTranslate } from '../../i18n/i18n.service';
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

  it('shows available competition options in PT and EN, without out-of-date team warnings', () => {
    const activityKeys = [
      'communityInviteStep.activityTitle',
      'communityInviteStep.activitySubtitle',
      'communityInviteStep.individualTitle',
      'communityInviteStep.teamsTitle',
      'communityInviteStep.teamsDescription',
      'communityInviteStep.teamsHint',
      'communityInviteStep.statisticsTitle',
      'communityInviteStep.sessionsTitle',
      'communityInviteStep.activitySelectedCount'
    ];

    for (const language of ['pt', 'en']) {
      localStorage.setItem('d24-language', language);
      for (const key of activityKeys) {
        expect(appTranslate(key)).not.toBe(key);
      }
      expect(appTranslate('communityInviteStep.teamsHint')).not.toMatch(/em desenvolvimento|in development/i);
      expect(appTranslate('communityInviteStep.activitySelectedCount', { count: 2 })).toContain('2');
    }
  });

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
    expect(component.activityChoiceMade).toBeFalse();
    expect(component.selectedActivities.size).toBe(0);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('lets organizer combine individual leagues and regular statistics', () => {
    const { component, groups, router } = setup();
    const update = jasmine.createSpy('updateFeatures').and.returnValue(of({}));
    (groups as any).updateFeatures = update;
    component.continueAfterInvite();
    component.chooseActivity('individual');
    component.chooseActivity('statistics');
    expect(component.selectedActivities.size).toBe(2);

    component.saveCompetitionAndContinue();
    expect(update).toHaveBeenCalledWith(42, {
      rankingsEnabled: true, individualTournamentsEnabled: true, teamTournamentsEnabled: false
    });
    expect(component.step).toBe('venue');
    expect(router.navigate).not.toHaveBeenCalled();
    component.setHabitualVenueChoice('no');
    component.continueToCommunity();
    expect(router.navigate).toHaveBeenCalledWith(['/menu/communities', 42]);
  });

  it('supports all four paths, including sessions-only and team tournaments', () => {
    const { component, groups } = setup();
    const update = jasmine.createSpy('updateFeatures').and.returnValue(of({}));
    (groups as any).updateFeatures = update;
    component.continueAfterInvite();
    component.chooseActivity('teams');
    component.chooseActivity('statistics');
    component.chooseActivity('individual');
    expect(component.selectedActivities.size).toBe(3);
    component.chooseSessionsOnly();
    expect(component.selectedActivities.size).toBe(0);
    expect(component.activityChoiceMade).toBeTrue();
    component.saveCompetitionAndContinue();
    expect(update).toHaveBeenCalledWith(42, {
      rankingsEnabled: false, individualTournamentsEnabled: false, teamTournamentsEnabled: false
    });
    expect(component.step).toBe('venue');
  });

  it('does not save without selecting an explicit path', () => {
    const { component, groups, router } = setup();
    const update = jasmine.createSpy('updateFeatures');
    (groups as any).updateFeatures = update;
    component.continueAfterInvite();
    component.saveCompetitionAndContinue();
    expect(update).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('does not let ordinary members configure competition', () => {
    const { component, router } = setup('MEMBER');
    component.chooseActivity('statistics');
    expect(component.selectedActivities.size).toBe(0);
    component.continueAfterInvite();
    expect(component.step).toBe('invite');
    expect(router.navigate).toHaveBeenCalledWith(['/menu/communities', 42]);
  });

  it('shows errors on failed saving and supports retrying', () => {
    const { component, router } = setup();
    const update = jasmine.createSpy('updateFeatures')
      .and.returnValue(throwError(() => new Error('network')));
    (component as any).groups.updateFeatures = update;
    component.continueAfterInvite();
    component.chooseActivity('statistics');
    component.saveCompetitionAndContinue();

    expect(router.navigate).not.toHaveBeenCalled();
    expect(component.competitionError).toBeTruthy();
    expect(component.competitionSaving).toBeFalse();
    expect(component.step).toBe('competition');

    update.and.returnValue(of({ rankingsEnabled: true }));
    component.saveCompetitionAndContinue();
    expect(component.step).toBe('venue');
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('lets people decide later without changing settings', () => {
    const { component, router } = setup();
    const update = jasmine.createSpy('updateFeatures');
    (component as any).groups.updateFeatures = update;
    component.continueAfterInvite();
    component.continueToCommunity();
    expect(update).not.toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/menu/communities', 42]);
  });

  it('asks about the habitual venue after deciding on competition options', () => {
    const { component, router } = setup();
    component.continueAfterInvite();
    component.continueToVenue();
    expect(component.step).toBe('venue');
    expect(component.habitualVenueChoice).toBeNull();
    expect(router.navigate).not.toHaveBeenCalled();
    component.setHabitualVenueChoice('yes');
    expect(component.habitualVenueChoice).toBe('yes');
    component.onHabitualVenueSaved({ id:42, name:'Futebol das Quintas',
      myRole:'OWNER', defaultVenueId:57, defaultVenueName:'Campo Municipal' } as CommunityGroup);
    expect(component.community?.defaultVenueId).toBe(57);
    expect(component.habitualVenueSaved).toBeTrue();
    component.continueToCommunity();
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
