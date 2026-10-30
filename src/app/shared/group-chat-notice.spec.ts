import { allowsGroupChatToast, confirmsGroupUnread, recentGroupChatEvent } from './group-chat-notice';
import { InboxSummary } from '../services/inbox-api.service';

describe('Group chat toast authorization helpers', () => {
  const preferences = {
    inAppEnabled: true, emailEnabled: true,
    disabledInAppTypes: [], disabledEmailTypes: []
  };
  const summary: InboxSummary = {
    kind: 'community', id: '35', latestMessageId: 102,
    latestText: 'Boa noite', latestSender: 'ana',
    latestAt: new Date().toISOString(), unreadCount: 2
  };

  it('honors global app muting and the chat notification category', () => {
    expect(allowsGroupChatToast(preferences)).toBeTrue();
    expect(allowsGroupChatToast({...preferences, inAppEnabled: false})).toBeFalse();
    expect(allowsGroupChatToast({...preferences, disabledInAppTypes: ['CHAT_MESSAGE']})).toBeFalse();
    expect(allowsGroupChatToast({...preferences, disabledInAppTypes: ['FRIEND_REQUEST']})).toBeTrue();
    expect(allowsGroupChatToast(null)).toBeFalse();
  });

  it('requires an exact authorized conversation, sender, message ID and unread count', () => {
    expect(confirmsGroupUnread(summary, 'community', 35, 102, 'ANA')).toBeTrue();
    expect(confirmsGroupUnread(summary, 'session', 35, 102, 'ana')).toBeFalse();
    expect(confirmsGroupUnread(summary, 'community', 36, 102, 'ana')).toBeFalse();
    expect(confirmsGroupUnread(summary, 'community', 35, 101, 'ana')).toBeFalse();
    expect(confirmsGroupUnread(summary, 'community', 35, 102, 'intruso')).toBeFalse();
    expect(confirmsGroupUnread({...summary, unreadCount: 0}, 'community', 35, 102, 'ana')).toBeFalse();
    expect(confirmsGroupUnread(undefined, 'community', 35, 102, 'ana')).toBeFalse();
  });

  it('ignores replayed, invalid and future events', () => {
    const now = Date.parse('2026-10-28T18:00:00Z');
    expect(recentGroupChatEvent(new Date(now - 1000).toISOString(), now)).toBeTrue();
    expect(recentGroupChatEvent(new Date(now - 30000).toISOString(), now)).toBeFalse();
    expect(recentGroupChatEvent(new Date(now + 4000).toISOString(), now)).toBeFalse();
    expect(recentGroupChatEvent('invalid', now)).toBeFalse();
  });
});
