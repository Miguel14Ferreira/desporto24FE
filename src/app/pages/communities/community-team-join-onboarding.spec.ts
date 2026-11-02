import { convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { CommunitiesComponent } from './communities.component';
import { appTranslate as t } from '../../i18n/i18n.service';

describe('Team invitation community onboarding', () => {
  function freshComponent(params: Record<string, string | undefined>): CommunitiesComponent {
    const component = Object.create(CommunitiesComponent.prototype) as CommunitiesComponent;
    (component as any).route = {
      snapshot: { queryParamMap: convertToParamMap(params) }
    };
    (component as any).pendingJoinLookupVersion = 0;
    component.joinRequestSent = false;
    component.membershipActionLoading = false;
    component.pendingJoinLookupLoading = false;
    return component;
  }

  it('recognises both new and legacy team invitations, never generic community links', () => {
    for (const params of [
      { tournament: '19', team: '40', teamPage: '40' },
      { tournament: '19', team: '40' }
    ]) {
      const component = freshComponent(params);
      expect(component.hasTeamInvitationDeepLink).toBeTrue();
      expect(component.invitedTournamentId).toBe(19);
      expect(component.invitedTeamId).toBe(40);
    }
    for (const params of [
      { tournament: '19' },
      { tournament: '19', teamPage: '40' },
      { tournament: '19', team: 'abc' },
      { tournament: '19', team: '-4' },
      { tournament: '0', team: '40' },
      {}
    ]) {
      expect(freshComponent(params).hasTeamInvitationDeepLink).toBeFalse();
    }
  });

  it('keeps the target intact when joining a public community before confirming the team', () => {
    const component = freshComponent({ tournament: '19', team: '40', teamPage: '40' });
    component.communityPresentation = { id: 7, visibility: 'PUBLIC' } as any;
    const joinPublic = jasmine.createSpy('joinPublic').and.returnValue(of({}));
    (component as any).communityService = { joinPublic };
    const reload = spyOn(component, 'reload').and.stub();

    component.joinPresentedCommunity();

    expect(joinPublic).toHaveBeenCalledOnceWith(7);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(component.invitedTournamentId).toBe(19);
    expect(component.invitedTeamId).toBe(40);
    expect(component.tournamentTeamPageId).toBe(40);
    expect(component.membershipActionLoading).toBeFalse();
  });

  it('requests approval for private communities without joining the team or sending a duplicate', () => {
    const component = freshComponent({ tournament: '19', team: '40', teamPage: '40' });
    component.communityPresentation = { id: 7, visibility: 'PRIVATE' } as any;
    const requestJoin = jasmine.createSpy('requestJoin').and.returnValue(of({}));
    (component as any).communityService = { requestJoin };
    const reload = spyOn(component, 'reload').and.stub();

    component.joinPresentedCommunity();

    expect(requestJoin).toHaveBeenCalledOnceWith(7);
    expect(component.joinRequestSent).toBeTrue();
    expect(component.membershipActionMessage).toBe(t('communities.joinRequestSent'));
    expect(reload).not.toHaveBeenCalled();
    component.joinPresentedCommunity();
    expect(requestJoin).toHaveBeenCalledTimes(1);
    expect(component.invitedTeamId).toBe(40);
  });

  it('provides complete invitation steps in Portuguese and English', () => {
    const prev = localStorage.getItem('d24-language');
    try {
      localStorage.setItem('d24-language', 'pt');
      expect(t('communities.teamInviteOnboarding.pendingHint')).toContain('pendente');
      expect(t('communities.teamInviteOnboarding.stepTeam')).toContain('equipa');
      localStorage.setItem('d24-language', 'en');
      expect(t('communities.teamInviteOnboarding.pendingHint')).toContain('pending');
      expect(t('communities.teamInviteOnboarding.stepTeam')).toContain('team');
    } finally {
      if (prev === null) localStorage.removeItem('d24-language');
      else localStorage.setItem('d24-language', prev);
    }
  });
});
