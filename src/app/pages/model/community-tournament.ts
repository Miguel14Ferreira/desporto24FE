export type TournamentStatus = 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED';
export type TournamentParticipantStatus = 'PENDING' | 'CONFIRMED';
export type TournamentMatchStatus = 'SCHEDULED' | 'COMPLETED';

export interface CommunityTournament {
  id: number;
  name: string;
  // Optional for cached responses from old API versions; new API always supplies it.
  sport?: string | null;
  format: 'LEAGUE';
  status: TournamentStatus;
  winPoints: number;
  drawPoints: number;
  lossPoints: number;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  championProfileId: number | null;
  championUsername: string | null;
  championDisplayName: string | null;
  championPoints: number | null;
  championTied: boolean;
}

export interface TournamentPage {
  tournaments: CommunityTournament[];
  page: number;
  hasMore: boolean;
}

export interface TournamentParticipant {
  profileId: number;
  username: string;
  displayName: string;
  joinedAt: string;
  status: TournamentParticipantStatus;
}

export interface TournamentParticipantPage {
  participants: TournamentParticipant[];
  page: number;
  hasMore: boolean;
}

export interface TournamentMatch {
  id: number;
  roundNumber: number;
  homeProfileId: number;
  homeUsername: string;
  awayProfileId: number;
  awayUsername: string;
  status: TournamentMatchStatus;
  homeScore: number | null;
  awayScore: number | null;
}

export interface TournamentMatchPage {
  matches: TournamentMatch[];
  page: number;
  hasMore: boolean;
}

export interface TournamentScheduleSummary {
  tournamentId: number;
  status: TournamentStatus;
  participantCount: number;
  roundCount: number;
  matchCount: number;
}

export interface TournamentStandingRow {
  position: number;
  profileId: number;
  username: string;
  displayName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export interface TournamentStandings {
  tournamentId: number;
  status: TournamentStatus;
  totalMatches: number;
  completedMatches: number;
  winPoints: number;
  drawPoints: number;
  lossPoints: number;
  standings: TournamentStandingRow[];
}
