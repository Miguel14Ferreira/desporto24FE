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
}

export interface CommunitySetScore {
  sideA: number | null;
  sideB: number | null;
}

export type CommunityRacketMatchFormat = 'SINGLES' | 'DOUBLES';

export interface CommunityRound {
  id: number;
  name: string;
  playedAt: string;
  sport?: string | null;
  matchFormat?: CommunityRacketMatchFormat | null;
  setScores?: CommunitySetScore[] | null;
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

export interface CommunityCompetitionOverview {
  settings: CommunityCompetitionSettings;
  seasons: CommunitySeason[];
  selectedSeasonId: number | null;
  activeSeasonId: number | null;
  rounds: CommunityRound[];
  standings: CommunityStanding[];
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
}
