import { CommunitiesComponent } from './communities.component';
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
