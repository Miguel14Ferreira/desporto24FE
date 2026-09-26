import { SessionSummary } from './session-summary';

export interface SessionDetail extends SessionSummary {
  creatorUsername: string | null;
  address: string | null;
  canSeeExactAddress: boolean;
  joined: boolean;
  waitlisted: boolean;
  waitlistPosition: number | null;
  gamePhoto: string | null;
}
