import { CommunityProfile } from '../model/community-profile';
import { MySessionsResponse } from '../model/my-sessions-response';
import { SessionSummary } from '../model/session-summary';
import { nextWeekGames, nextWeekWaitlist, weekOffers } from './my-sports-week';

describe('A minha semana desportiva — dados reais e privacidade', () => {
  const now = Date.parse('2026-10-17T15:00:00Z');
  const session = (id: number, hoursAhead: number, overrides: Partial<SessionSummary> = {}): SessionSummary => ({
    id, sport: 'Futebol', city: 'Lisboa',
    gameDate: new Date(now + hoursAhead * 3600_000).toISOString(),
    distanceKm: null, participantCount: 2, maxParticipants: 6, priceAmount: 0,
    status: 'OPEN', privateGame: false, audience: 'PUBLIC', ...overrides
  });
  const mine: MySessionsResponse = { created: [], joined: [], waitlisted: [] };

  it('only shows this-week confirmed games, deduplicating created and joined', () => {
    const repeated = session(2, 8, { privateGame: true, audience: 'COMMUNITY_ONLY' });
    const selection: MySessionsResponse = {
      created: [session(1, 24), repeated, session(3, 8 * 24)],
      joined: [repeated, session(4, -2), session(5, 2, { status: 'CANCELLED' })],
      waitlisted: [session(7, 5)]
    };
    expect(nextWeekGames(selection, now).map(game => game.id)).toEqual([2, 1]);
  });

  it('keeps waitlist separate from confirmed and ignores past entries', () => {
    const selection: MySessionsResponse = {
      created: [session(2, 5)], joined: [],
      waitlisted: [session(2, 5), session(3, 12), session(4, -2), session(5, 8 * 24)]
    };
    expect(nextWeekWaitlist(selection, now).map(game => game.id)).toEqual([3]);
  });

  it('never recommends private or community-only games, full or cancelled ones or ones already joined', () => {
    const previouslyJoined = session(3, 6);
    const candidates = [
      session(1, 9, { privateGame: true }),
      session(2, 8, { audience: 'COMMUNITY_ONLY' }),
      previouslyJoined,
      session(4, 7, { participantCount: 6 }),
      session(5, 6, { status: 'CANCELLED' }),
      session(6, 5, { joinedByViewer: true }),
      session(7, 4, { waitlistedByViewer: true }),
      session(8, 8 * 24),
      session(9, -2),
      session(10, 30),
      session(11, 20),
      session(11, 20)
    ];
    expect(weekOffers(candidates, { ...mine, joined: [previouslyJoined] }, null, now)
      .map(game => game.id)).toEqual([11, 10]);
  });

  it('filters public vacancies using viewer membership even without a my-sessions response', () => {
    const candidates = [
      session(1, 5), session(2, 6, { joinedByViewer: true }),
      session(3, 7, { waitlistedByViewer: true }),
      session(4, 8, { privateGame: true }),
      session(5, 9, { audience: 'COMMUNITY_ONLY' })
    ];
    expect(weekOffers(candidates, null, null, now).map(game => game.id)).toEqual([1]);
  });

  it('prioritizes favourite sports and home city without exposing private sessions', () => {
    const me = {
      username: 'test', favoriteSports: 'Padel, Futébol', location: 'Lisboa'
    } as CommunityProfile;
    const candidates = [
      session(1, 1, { sport: 'Natação', city: 'Porto' }),
      session(2, 48, { sport: 'Padel', city: 'Porto' }),
      session(3, 72, { sport: 'Futebol', city: 'Lisboa' }),
      session(4, 3, { sport: 'Natação', city: 'Lisboa' }),
      session(5, 2, { sport: 'Padel', city: 'Lisboa', privateGame: true })
    ];
    expect(weekOffers(candidates, mine, me, now).map(game => game.id)).toEqual([3, 2, 4]);
  });

  it('does not mutate API collections', () => {
    const candidates = [session(1, 15), session(2, 8)];
    expect(weekOffers(candidates, mine, null, now).map(g => g.id)).toEqual([2, 1]);
    expect(candidates.map(g => g.id)).toEqual([1, 2]);
  });
});
