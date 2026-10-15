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
});
