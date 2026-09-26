export interface FriendSummary {
  username: string;
  fullName: string | null;
  location: string | null;
  favoriteSports: string | null;
  profilePicUrl: string | null;
  chatBlocked: boolean;
  blockedByMe: boolean;
}
