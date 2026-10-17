import { CommunityProfile } from '../model/community-profile';
import { MySessionsResponse } from '../model/my-sessions-response';
import { SessionSummary } from '../model/session-summary';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function normalized(value: string | null | undefined): string {
  return (value ?? '').trim().toLocaleLowerCase('pt')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function upcoming(session: SessionSummary, now: number): boolean {
  const time = Date.parse(session.gameDate);
  return Number.isFinite(time) && time >= now && time < now + WEEK_MS
    && ['OPEN', 'FULL'].includes(session.status?.toUpperCase() ?? '');
}

export function nextWeekGames(
  mine: MySessionsResponse, now = Date.now()
): SessionSummary[] {
  const unique = new Map<number, SessionSummary>();
  [...mine.created, ...mine.joined].forEach(session => {
    if (upcoming(session, now) && !unique.has(session.id)) unique.set(session.id, session);
  });
  return [...unique.values()]
    .sort((a, b) => Date.parse(a.gameDate) - Date.parse(b.gameDate))
    .slice(0, 3);
}

export function nextWeekWaitlist(
  mine: MySessionsResponse, now = Date.now()
): SessionSummary[] {
  const confirmed = new Set([...mine.created, ...mine.joined].map(game => game.id));
  return mine.waitlisted
    .filter(session => upcoming(session, now) && !confirmed.has(session.id))
    .sort((a, b) => Date.parse(a.gameDate) - Date.parse(b.gameDate))
    .slice(0, 2);
}

export function weekOffers(
  discovered: SessionSummary[], mine: MySessionsResponse | null,
  me: CommunityProfile | null, now = Date.now()
): SessionSummary[] {
  const occupied = new Set(mine ? [...mine.created, ...mine.joined, ...mine.waitlisted]
    .map(session => session.id) : []);
  const mySports = new Set((me?.favoriteSports ?? '').split(/[,;|]/)
    .map(normalized).filter(Boolean));
  const myCity = normalized(me?.location);
  const unique = new Map<number, SessionSummary>();

  discovered.forEach(session => {
    if (upcoming(session, now)
      && session.status?.toUpperCase() === 'OPEN'
      && session.audience !== 'COMMUNITY_ONLY'
      && !session.privateGame
      && session.maxParticipants > session.participantCount
      && !session.joinedByViewer && !session.waitlistedByViewer
      && !occupied.has(session.id) && !unique.has(session.id)) {
      unique.set(session.id, session);
    }
  });

  const rank = (session: SessionSummary): number =>
    (mySports.has(normalized(session.sport)) ? 2 : 0)
    + (myCity && normalized(session.city) === myCity ? 1 : 0);

  return [...unique.values()]
    .sort((a, b) => rank(b) - rank(a)
      || Date.parse(a.gameDate) - Date.parse(b.gameDate) || a.id - b.id)
    .slice(0, 3);
}
