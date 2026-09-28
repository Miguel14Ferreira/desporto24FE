export type FeedItemType = 'POST' | 'SESSION_CREATED';

export interface FeedItem {
  type: FeedItemType;
  postId: number | null;
  authorUsername: string;
  authorDisplayName: string;
  authorProfilePicUrl: string | null;
  content: string | null;
  createdAt: string;
  sessionId: number | null;
  sport: string | null;
  city: string | null;
  gameDate: string | null;
}
