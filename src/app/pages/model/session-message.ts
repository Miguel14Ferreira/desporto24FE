export interface SessionMessage {
  id: number;
  sessionId: number;
  senderUsername: string;
  body: string;
  createdAt: string;
  replyToMessageId?: number | null;
  replyToSender?: string | null;
  replyToText?: string | null;
  attachmentName?: string | null;
  attachmentMimeType?: string | null;
  attachmentSize?: number | null;
}
