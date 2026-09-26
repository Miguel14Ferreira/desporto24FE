export type AttendanceDisputeStatus =
  | 'OPEN'
  | 'ACCEPTED'
  | 'REJECTED';

export interface AttendanceDisputeItem {
  id: number;
  participantId: number;
  sessionId: number;
  sport: string;
  city: string;
  gameDate: string | null;
  participantUsername: string;
  reporterUsername: string;
  reason: string;
  status: AttendanceDisputeStatus;
  createdAt: string;
  resolvedAt: string | null;
}
