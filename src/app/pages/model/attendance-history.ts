export type AttendanceStatus =
  | 'PENDING'
  | 'ATTENDED'
  | 'NO_SHOW'
  | 'LATE_CANCELLED';

export type AttendanceDisputeStatus =
  | 'OPEN'
  | 'ACCEPTED'
  | 'REJECTED';

export interface AttendanceHistoryItem {
  participantId: number;
  sessionId: number;
  sport: string;
  city: string;
  gameDate: string | null;
  attendanceStatus: AttendanceStatus;
  attendanceRecordedAt: string | null;
  disputeStatus: AttendanceDisputeStatus | null;
  canDispute: boolean;
}
