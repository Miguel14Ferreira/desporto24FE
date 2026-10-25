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
  scoringMode?: 'CHESS_HALF_POINTS' | 'RACE_POINTS' | null;
  playersPerTeam?: number | null;
  roundRobinLegs?: 1 | 2;
  teamTieBreakPriority?: TeamTieBreakPriority;
  format: 'LEAGUE' | 'KNOCKOUT' | 'GROUP_KNOCKOUT';
  groupCount?: 2 | 4 | null;
  historicalArchiveId?: number | null;
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
  playersPerTeam: number | null;
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

/** Karting championship only. Race entries are the existing community round results. */
export interface TournamentRaceEntry {
  communityPlayerId: number | null;
  fullName: string | null;
  finishPosition: number | null;
  elapsedSeconds: number | null;
  bestLapSeconds: number | null;
  racePenaltyPoints: number;
  racePenaltyReason?: string | null;
  raceTimePenaltySeconds?: number | null;
  adjustedElapsedSeconds?: number | null;
  raceStewardReason?: string | null;
  lapsCompleted?: number | null;
  raceDisqualified: boolean;
}

export interface TournamentRaceRound {
  id: number;
  name: string;
  sport: string | null;
  playedAt: string;
  entries: TournamentRaceEntry[];
}

export interface TournamentRaceStanding {
  position: number;
  playerId: number;
  fullName: string | null;
  races: number;
  wins: number;
  podiums: number;
  bestFinish: number | null;
  championshipPoints: number | null;
  penaltyPoints: number;
}

export interface TournamentRaceOverview {
  tournamentId: number;
  pointsByPlace: number[];
  linkedRaces: TournamentRaceRound[];
  availableRaces: TournamentRaceRound[];
  standings: TournamentRaceStanding[];
}

/** Official World Skate 2026 progression; never inferred as a final placement. */
export type InlineSpeedStage = 'FIRST' | 'QUARTER' | 'SEMI' | 'FINAL';
export interface InlineSpeedSkater {
  playerId: number;
  name: string;
  position: number | null;
  seconds: number | null;
  disqualified: boolean;
}
export interface InlineSpeedHeat {
  roundId: number;
  name: string;
  eventType: string;
  heatNumber: number;
  skaters: InlineSpeedSkater[];
}
export interface InlineSpeedProposal {
  sourceStage: Exclude<InlineSpeedStage, 'FINAL'>;
  targetStage: Exclude<InlineSpeedStage, 'FIRST'>;
  playerIds: number[];
  expectedCount: number;
  ready: boolean;
  warning: string;
}
export interface InlineSpeedDecision {
  sourceStage: Exclude<InlineSpeedStage, 'FINAL'>;
  targetStage: Exclude<InlineSpeedStage, 'FIRST'>;
  playerIds: number[];
  reason: string | null;
  confirmedBy: string;
  confirmedAt: string;
  stale: boolean;
}
export type InlineSpeedTieEvidenceType = 'PHOTO_FINISH' | 'VIDEO_REVIEW' | 'OFFICIAL_MINUTES' | 'TIEBREAK_TRIAL' | 'OTHER';

export interface InlineSpeedTieBreakRevision {
  revision: number;
  selectedPlayerIds: number[];
  reason: string;
  trialOrderExceptionReason?: string | null;
  evidenceType?: InlineSpeedTieEvidenceType | null;
  evidenceReference?: string | null;
  trialIds?: number[];
  confirmedBy: string;
  confirmedAt: string;
  stale: boolean;
}
export interface InlineSpeedTieBreak {
  sourceStage: 'FIRST';
  selectedPlayerIds: number[];
  reason: string;
  trialOrderExceptionReason?: string | null;
  evidenceType?: InlineSpeedTieEvidenceType | null;
  evidenceReference?: string | null;
  trialIds?: number[];
  confirmedBy: string;
  confirmedAt: string;
  stale: boolean;
  revisions?: InlineSpeedTieBreakRevision[];
}

export interface InlineSpeedTrialResult {
  playerId: number;
  place: number;
  seconds: number | null;
}
export interface InlineSpeedTrial {
  id: number;
  sourceStage: 'FIRST';
  heldAt: string;
  officialReference: string;
  reason: string;
  recordedBy: string;
  recordedAt: string;
  stale: boolean;
  results: InlineSpeedTrialResult[];
}
export interface InlineSpeedTrialRequest {
  actuallyHeld: boolean;
  heldAt: string;
  officialReference: string;
  reason: string;
  results: InlineSpeedTrialResult[];
}

export interface InlineSpeedOverview {
  tournamentId: number;
  discipline: 'TRACK_500D' | 'ROAD_LAP' | null;
  linkedHeats: InlineSpeedHeat[];
  availableHeats: InlineSpeedHeat[];
  proposals: InlineSpeedProposal[];
  decisions: InlineSpeedDecision[];
  tieBreaks?: InlineSpeedTieBreak[];
  trials?: InlineSpeedTrial[];
}
