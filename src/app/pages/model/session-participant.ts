export type AttendanceStatus = 'PENDING' | 'ATTENDED' | 'NO_SHOW' | 'LATE_CANCELLED';

export interface SessionParticipant {
  id: number;
  username: string;
  profilePicUrl?: string | null;
  attendanceStatus: AttendanceStatus;
  joinedAt: string;
  teamCode?: 'A' | 'B' | null;
}
