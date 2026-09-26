import { SessionSummary } from './session-summary';

export interface MySessionsResponse {
  created: SessionSummary[];
  joined: SessionSummary[];
  waitlisted: SessionSummary[];
}
