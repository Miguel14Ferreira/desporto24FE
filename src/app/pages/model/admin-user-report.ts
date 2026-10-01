export type UserReportStatus = 'OPEN' | 'REVIEWED' | 'DISMISSED';
export type ClosedUserReportStatus = Exclude<UserReportStatus, 'OPEN'>;

export interface AdminUserReport {
  id: number;
  reporterUsername: string;
  reportedUsername: string;
  reason: string;
  status: UserReportStatus;
  createdAt: string | null;
}
