export interface FriendSummary {
  username: string;
  fullName: string | null;
  nickname: string | null;
  profilePicUrl: string | null;
  chatBlocked: boolean;
  blockedByMe: boolean;
}
