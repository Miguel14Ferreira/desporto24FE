export interface ReliabilitySummary {
  attendanceRate: number;
  completedSessions: number;
  noShows: number;
  lateCancellations: number;
  penaltyScore: number;
  warning: boolean;
  reducedPriority: boolean;
  joinRestricted: boolean;
}
