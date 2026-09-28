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
  photoUrl: string | null;
  visibility: CommunityVisibility;
  rankingsEnabled: boolean;
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
  profileId: number;
  username: string;
  fullName: string | null;
  profilePicUrl: string | null;
  team: string | null;
  result: CommunityMatchResult;
  goals: number;
  assists: number;
  mvp: boolean;
  cleanSheet: boolean;
}

export interface CommunityRound {
  id: number;
  name: string;
  playedAt: string;
  entries: CommunityRoundEntry[];
}

export interface CommunityStanding {
  position: number;
  profileId: number;
  username: string;
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
}
