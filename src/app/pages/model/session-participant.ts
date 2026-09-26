export type AttendanceStatus = 'PENDING' | 'ATTENDED' | 'NO_SHOW' | 'LATE_CANCELLED';

export interface SessionParticipant {
  id: number;
  username: string;
  attendanceStatus: AttendanceStatus;
  joinedAt: string;
}
