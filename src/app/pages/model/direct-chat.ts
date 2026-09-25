export interface DirectChatMessage {
  id: number | null;
  username1: string;
  username2: string;
  text: string;
  dataDisplay: string | null;
  date: string | null;
}

export interface DirectChatInfo {
  chatBlocked: boolean;
  whoBlocked: string | null;
}
