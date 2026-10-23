export type CommunityRole = 'OWNER' | 'ADMIN' | 'MEMBER';
export type CommunityVisibility = 'PUBLIC' | 'PRIVATE';

export interface CommunityMember {
  profileId: number;
  username: string;
  fullName: string | null;
  profilePicUrl: string | null;
  role: CommunityRole;
}

export interface CommunityGroup {
  id: number;
  name: string;
  description: string | null;
  sport: string | null;
  sports?: string[];
  photoUrl: string | null;
  visibility: CommunityVisibility;
  rankingsEnabled: boolean;
  individualTournamentsEnabled?: boolean;
  teamTournamentsEnabled?: boolean;
  ownerUsername: string;
  myRole: CommunityRole | null;
  memberCount: number;
  createdAt: string;
  members: CommunityMember[];
}

export interface CommunityInvite {
  id: number;
  communityId: number;
  communityName: string;
  invitedByUsername: string;
  createdAt: string;
}


export type CommunityMatchResult = 'WIN' | 'DRAW' | 'LOSS';

export interface CommunityCompetitionSettings {
  rankingsEnabled: boolean;
  winPoints: number;
  drawPoints: number;
  lossPoints: number;
}

export interface CommunityRoundEntry {
  profileId: number | null;
  username: string | null;
  fullName: string | null;
  profilePicUrl: string | null;
  team: string | null;
  result: CommunityMatchResult;
  goals: number;
  assists: number;
  mvp: boolean;
  cleanSheet: boolean;
  finishPosition?: number | null;
  elapsedSeconds?: number | null;
  bestLapSeconds?: number | null;
  lapsCompleted?: number | null;
  entryId?: number | null;
  communityPlayerId?: number | null;
  racePenaltyPoints?: number;
  racePenaltyReason?: string | null;
  raceTimePenaltySeconds?: number | null;
  adjustedElapsedSeconds?: number | null;
  raceDisqualified?: boolean;
  raceStewardReason?: string | null;
  performanceValue?: number | null;
  waveScore1?: number | null;
  waveScore2?: number | null;
}

export interface CommunitySetScore {
  sideA: number | null;
  sideB: number | null;
}

export type CommunityRacketMatchFormat = 'SINGLES' | 'DOUBLES';

export interface CommunityGroupRoutineScore {
  groupName: string;
  score: number | null;
}

export interface CommunityTeamFinalScore { sideA: number | null; sideB: number | null; }

export interface CommunityBasketballScore {
  sideA: number | null;
  sideB: number | null;
}

export interface CommunityRound {
  id: number;
  name: string;
  playedAt: string;
  sport?: string | null;
  eventType?: 'RACE' | 'FREESTYLE' | 'TRACK' | 'JUMP' | 'THROW' | 'HEAT' | 'BODYBOARD_HEAT' | 'APPARATUS'
    | 'SKATE_PARK' | 'SKATE_STREET' | 'PARKOUR_SPEED' | 'PARKOUR_FREESTYLE'
    | 'BREAKING_BATTLE' | 'TRAMPOLINE_INDIVIDUAL'
    | 'RHYTHMIC_APPARATUS' | 'ARTISTIC_SOLO_TECHNICAL' | 'ARTISTIC_SOLO_FREE'
    | 'RHYTHMIC_GROUP_5' | 'RHYTHMIC_GROUP_3_2'
    | 'ARTISTIC_DUET_TECH' | 'ARTISTIC_DUET_FREE'
    | 'ARTISTIC_TEAM_TECH' | 'ARTISTIC_TEAM_FREE'
    | 'BASKETBALL_FINAL' | 'BASKETBALL_3X3_FINAL'
    | 'VOLLEYBALL_FINAL' | 'BEACH_VOLLEY_FINAL' | 'HANDBALL_FINAL' | 'RUGBY_FINAL' | 'RUGBY_SEVENS_FINAL'
    | 'FUTSAL_FINAL' | 'FIELD_HOCKEY_FINAL' | 'ROLLER_HOCKEY_FINAL' | 'WATER_POLO_FINAL'
    | 'FOOTVOLLEY_SINGLE_18' | 'FOOTVOLLEY_BEST_OF_3' | 'FOOTVOLLEY_SINGLE_15' | null;
  eventDiscipline?: string | null;
  matchFormat?: CommunityRacketMatchFormat | null;
  setScores?: CommunitySetScore[] | null;
  groupScores?: CommunityGroupRoutineScore[] | null;
  basketballScore?: CommunityBasketballScore | null;
  teamScore?: CommunityTeamFinalScore | null;
  entries: CommunityRoundEntry[];
}

export interface CommunitySeason {
  id: number;
  name: string;
  startsAt: string;
  endedAt: string | null;
  active: boolean;
  championUsername: string | null;
  championDisplayName: string | null;
  championPoints: number | null;
}

export interface CommunityStanding {
  position: number;
  profileId: number | null;
  username: string | null;
  fullName: string | null;
  profilePicUrl: string | null;
  games: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  goals: number;
  assists: number;
  mvps: number;
  cleanSheets: number;
  winRate: number;
  currentStreak: string;
  bestWinStreak: number;
}

export interface CommunityRacketScoringRule {
  sport: string;
  matchFormat: CommunityRacketMatchFormat;
  winPoints: number;
  lossPoints: number;
  tieBreak: 'SETS_FIRST' | 'SCORE_FIRST';
}

export interface CommunityRacketStanding {
  position: number;
  profileId: number;
  username: string | null;
  fullName: string;
  profilePicUrl: string | null;
  matches: number;
  wins: number;
  losses: number;
  setsWon: number;
  setsLost: number;
  setDifference: number;
  gamesOrPointsWon: number;
  gamesOrPointsLost: number;
  gamesOrPointsDifference: number;
  championshipPoints?: number | null;
}

export interface CommunityRacketStandingGroup {
  sport: string;
  matchFormat: CommunityRacketMatchFormat;
  standings: CommunityRacketStanding[];
  rule?: CommunityRacketScoringRule | null;
}

export interface CommunityRaceRule {
  sport: string;
  pointsByPlace: number[];
}

export interface CommunityRaceStanding {
  position: number;
  playerId: number;
  profileId: number | null;
  username: string | null;
  fullName: string | null;
  profilePicUrl: string | null;
  races: number;
  wins: number;
  podiums: number;
  bestFinish: number | null;
  championshipPoints: number | null;
  penaltyPoints: number;
}

export interface CommunityRaceStandingGroup {
  sport: string;
  rule: CommunityRaceRule | null;
  standings: CommunityRaceStanding[];
}

export interface CommunityCompetitionOverview {
  settings: CommunityCompetitionSettings;
  seasons: CommunitySeason[];
  selectedSeasonId: number | null;
  activeSeasonId: number | null;
  rounds: CommunityRound[];
  standings: CommunityStanding[];
  racketStandings?: CommunityRacketStandingGroup[];
  raceStandings?: CommunityRaceStandingGroup[];
}

export interface CommunityRoundEntryDraft {
  username: string;
  included: boolean;
  team: string;
  result: CommunityMatchResult;
  goals: number;
  assists: number;
  mvp: boolean;
  cleanSheet: boolean;
  finishPosition?: number | null;
  elapsedSeconds?: number | null;
  bestLapSeconds?: number | null;
  lapsCompleted?: number | null;
  performanceValue?: number | null;
  waveScore1?: number | null;
  waveScore2?: number | null;
}
