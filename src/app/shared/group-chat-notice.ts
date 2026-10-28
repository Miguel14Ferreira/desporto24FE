import { NotificationPreferences } from '../services/notification-api.service';
import { InboxSummary } from '../services/inbox-api.service';

export type GroupChatKind = 'community' | 'session' | 'private';

export interface GroupChatToast {
  kind: GroupChatKind;
  groupId: number;
  sender: string;
  text: string;
  mimeType?: string | null;
  title?: string;
}

/** Group toasts are foreground hints, not persisted notification records.
 * The server must still authorize the current membership before showing one. */
export function allowsGroupChatToast(preferences: NotificationPreferences | null | undefined): boolean {
  return Boolean(preferences?.inAppEnabled
    && !preferences.disabledInAppTypes?.includes('CHAT_MESSAGE'));
}

export function confirmsGroupUnread(
  summary: InboxSummary | undefined,
  kind: 'community' | 'session',
  id: number,
  messageId: number,
  sender: string
): boolean {
  return Boolean(summary && summary.kind === kind && summary.id === String(id)
    && summary.latestMessageId === messageId
    && summary.latestSender?.toLowerCase() === sender.toLowerCase()
    && Number.isFinite(summary.unreadCount) && summary.unreadCount > 0);
}

export function recentGroupChatEvent(createdAt: string | null | undefined, now = Date.now()): boolean {
  const timestamp = Date.parse(createdAt ?? '');
  return Number.isFinite(timestamp) && now - timestamp >= -3_000 && now - timestamp < 30_000;
}
