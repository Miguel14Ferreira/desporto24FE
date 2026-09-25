export type AppNotificationType =
  | 'WAITLIST_PROMOTED'
  | 'SESSION_REMOVED'
  | 'SESSION_CANCELLED'
  | string
  | null;

export interface AppNotification {
  id: number;
  subject: string;
  message: string;
  greeting: string;
  signature: string;
  createdAt: string;
  friendRequest: boolean;
  updateProfile: boolean;
  sessionInvite: boolean;
  normalMessage: boolean;
  token: string | null;
  type: AppNotificationType;
  sessionId: number | null;
  read: boolean;
  username: string;
}
