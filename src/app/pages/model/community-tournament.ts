export type TournamentStatus = 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED';

export type TeamTieBreakPriority =
  'GOAL_DIFFERENCE_FIRST' | 'GOALS_SCORED_FIRST' | 'WINS_FIRST';

export interface TournamentPointRules {
  winPoints: number;
  drawPoints: number;
  lossPoints: number;
}
export type TournamentParticipantStatus = 'PENDING' | 'CONFIRMED';
export type TournamentMatchStatus = 'SCHEDULED' | 'COMPLETED';

export interface CommunityTournament {
  id: number;
  name: string;
  // Optional for cached responses from old API versions; new API always supplies it.
  sport?: string | null;
  // Older individual competitions may omit these fields in cached responses.
  entryType?: 'INDIVIDUAL' | 'TEAM';
  playersPerTeam?: number | null;
  roundRobinLegs?: 1 | 2;
  teamTieBreakPriority?: TeamTieBreakPriority;
  format: 'LEAGUE' | 'KNOCKOUT' | 'GROUP_KNOCKOUT';
  groupCount?: 2 | 4 | null;
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
  championTeamId?: number | null;
  championTeamName?: string | null;
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

/** Real teams are independent from individual tournament participants and community statistics. */
export interface TournamentTeamPlayer {
  profileId: number;
  username: string;
  displayName: string;
}

export interface TournamentTeam {
  id: number;
  name: string;
  playersPerTeam: number;
  createdAt: string;
  players: TournamentTeamPlayer[];
}

/** Team fixtures never use individual tournament participant IDs. */
export interface TournamentTeamMatch {
  id: number;
  roundNumber: number;
  homeTeamId: number;
  homeTeamName: string;
  awayTeamId: number;
  awayTeamName: string;
  status: TournamentMatchStatus;
  homeScore?: number | null;
  awayScore?: number | null;
  groupNumber?: number | null;
}

export interface TournamentTeamMatchPage {
  matches: TournamentTeamMatch[];
  page: number;
  hasMore: boolean;
}

export interface TournamentTeamScheduleSummary {
  tournamentId: number;
  status: TournamentStatus;
  teamCount: number;
  roundCount: number;
  matchCount: number;
}

export interface TournamentTeamStandingRow {
  position: number;
  teamId: number;
  teamName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

export interface TournamentTeamGroup {
  groupNumber: number;
  standings: TournamentTeamStandingRow[];
}

export interface TournamentTeamGroups {
  tournamentId: number;
  knockoutStarted: boolean;
  groups: TournamentTeamGroup[];
}

export interface TournamentTeamStandings {
  tournamentId: number;
  status: TournamentStatus;
  totalMatches: number;
  completedMatches: number;
  winPoints: number;
  drawPoints: number;
  lossPoints: number;
  standings: TournamentTeamStandingRow[];
}
