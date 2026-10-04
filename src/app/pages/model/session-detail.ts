import { SessionSummary } from './session-summary';
import { Venue } from './venue';

export interface SessionDetail extends SessionSummary {
  creatorUsername: string | null;
  address: string | null;
  canSeeExactAddress: boolean;
  joined: boolean;
  waitlisted: boolean;
  waitlistPosition: number | null;
  gamePhoto: string | null;
  venue?: Venue | null;
  problemType?: 'NOT_OCCURRED' | 'VENUE_PROBLEM' | 'OTHER' | null;
  problemDetails?: string | null;
}
