import { CommunitiesComponent } from './communities.component';
import { of } from 'rxjs';
import { SessionSummary } from '../model/session-summary';

describe('CommunitiesComponent public session eligibility', () => {
  let component: CommunitiesComponent;
  let session: SessionSummary;

  beforeEach(() => {
    component = Object.create(CommunitiesComponent.prototype) as CommunitiesComponent;
    spyOn(component, 'canManage').and.returnValue(true);
    session = {
      id: 42,
      sport: 'Futebol',
      city: 'Lisboa',
      gameDate: new Date(Date.now() + 3_600_000).toISOString(),
      distanceKm: null,
      participantCount: 2,
      maxParticipants: 10,
      priceAmount: 0,
      privateGame: false,
      audience: 'COMMUNITY_ONLY',
      status: 'OPEN'
    };
  });

  it('allows joining an upcoming open community session', () => {
    expect(component.canJoinCommunitySession(session)).toBeTrue();
  });

  it('hides joining when a community session has started or ended', () => {
    session.gameDate = new Date(Date.now() - 60_000).toISOString();
    expect(component.canJoinCommunitySession(session)).toBeFalse();
    session.gameDate = new Date(Date.now() + 3_600_000).toISOString();
    for (const status of ['CANCELLED', 'COMPLETED']) {
      session.status = status;
      expect(component.canJoinCommunitySession(session)).toBeFalse();
    }
  });

  it('hides joining for private games or existing participation', () => {
    session.privateGame = true;
    expect(component.canJoinCommunitySession(session)).toBeFalse();
    session.privateGame = false;
    session.joinedByViewer = true;
    expect(component.canJoinCommunitySession(session)).toBeFalse();
    session.joinedByViewer = false;
    session.waitlistedByViewer = true;
    expect(component.canJoinCommunitySession(session)).toBeFalse();
  });

  it('allows opening an upcoming community-only session', () => {
    expect(component.canOpenSessionToPublic(session)).toBeTrue();
  });

  it('hides the action for sessions that already started', () => {
    session.gameDate = new Date(Date.now() - 60_000).toISOString();
    expect(component.canOpenSessionToPublic(session)).toBeFalse();
  });

  it('hides the action for cancelled and completed sessions', () => {
    for (const status of ['CANCELLED', 'COMPLETED']) {
      session.status = status;
      expect(component.canOpenSessionToPublic(session)).toBeFalse();
    }
  });

  it('hides the action for full and already public sessions', () => {
    session.participantCount = session.maxParticipants;
    expect(component.canOpenSessionToPublic(session)).toBeFalse();
    session.participantCount = 2;
    session.audience = 'PUBLIC';
    expect(component.canOpenSessionToPublic(session)).toBeFalse();
  });

  it('hides the action for non-managers', () => {
    (component.canManage as jasmine.Spy).and.returnValue(false);
    expect(component.canOpenSessionToPublic(session)).toBeFalse();
  });
  it('shows discovery sports with legacy and no-sport fallback', () => {
    expect(component.communitySports({
      sport: 'Futebol', sports: ['Futebol', 'Padel', 'Natação']
    })).toEqual(['Futebol', 'Padel', 'Natação']);
    expect(component.communitySports({ sport: 'Ténis' })).toEqual(['Ténis']);
    expect(component.communitySports({ sport: null, sports: [] })).toEqual([]);
  });

  it('reads both legacy single-sport groups and the new sports array', () => {
    const group = {
      id: 7, name: 'CNG', description: null, sport: 'Futebol',
      visibility: 'PRIVATE', myRole: 'OWNER', memberCount: 2
    } as any;
    expect(component.communitySports(group)).toEqual(['Futebol']);
    group.sports = ['Futebol', 'Padel'];
    expect(component.communitySports(group)).toEqual(['Futebol', 'Padel']);
    group.sport = null;
    group.sports = [];
    expect(component.communitySports(group)).toEqual([]);
  });


  it('preserves all optional modules for legacy responses but hides disabled ones', () => {
    const group = { id: 7, rankingsEnabled: false } as any;
    expect(component.hasCompetitions(group)).toBeTrue();
    group.individualTournamentsEnabled = false;
    group.teamTournamentsEnabled = false;
    expect(component.hasCompetitions(group)).toBeFalse();
    group.teamTournamentsEnabled = true;
    expect(component.hasCompetitions(group)).toBeTrue();
    component.selected = group;
    component.setTab('ranking');
    expect(component.activeTab).not.toBe('ranking');
    group.rankingsEnabled = true;
    component.setTab('ranking');
    expect(component.activeTab).toBe('ranking');
  });

  it('allows manager to configure independent modules and saves without clearing history', () => {
    const original = { id: 7, rankingsEnabled: true,
      individualTournamentsEnabled: true, teamTournamentsEnabled: false } as any;
    component.selected = original;
    (component.canManage as jasmine.Spy).and.returnValue(true);
    const update = jasmine.createSpy('updateFeatures').and.returnValue(
      of({ ...original, rankingsEnabled: false,
        individualTournamentsEnabled: false, teamTournamentsEnabled: true }));
    const groups = { updateFeatures: update } as any;
    (component as any).communityService = groups;
    component.communities = [original];
    spyOn(component as any, 'loadCompetition');
    component.editFeatures();
    expect(component.featuresEditing).toBeTrue();
    component.featuresDraft.rankingsEnabled = false;
    component.featuresDraft.individualTournamentsEnabled = false;
    component.featuresDraft.teamTournamentsEnabled = true;
    component.saveFeatures();
    expect(update).toHaveBeenCalledWith(7, {
      rankingsEnabled: false, individualTournamentsEnabled: false,
      teamTournamentsEnabled: true
    });
    expect(component.selected?.teamTournamentsEnabled).toBeTrue();
    expect(component.featuresEditing).toBeFalse();
  });

  it('lets organizers edit sport lists but prevents members changing them', () => {
    const group = {
      id: 7, name: 'CNG', sport: 'Futebol', sports: ['Futebol'],
      myRole: 'OWNER'
    } as any;
    component.selected = group;
    (component.canManage as jasmine.Spy).and.returnValue(true);
    component.editSports();
    expect(component.editingSports).toBeTrue();
    component.sportsSearch = 'pad';
    expect(component.availableSportSuggestions).toContain('Padel');
    component.addCommunitySport('Padel');
    component.addCommunitySport('Padel');
    expect(component.sportsDraft).toEqual(['Futebol', 'Padel']);
    component.removeCommunitySport('Futebol');
    expect(component.sportsDraft).toEqual(['Padel']);
    component.cancelSportsEdit();
    expect(component.editingSports).toBeFalse();
    (component.canManage as jasmine.Spy).and.returnValue(false);
    component.editSports();
    expect(component.editingSports).toBeFalse();
  });

});
