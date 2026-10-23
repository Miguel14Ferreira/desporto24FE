import { of, Subject, throwError, BehaviorSubject } from 'rxjs';
import { MessagesCenterComponent } from './messages-center.component';
import {
  InboxConversation, InboxMessage, inboxKey, matchesInboxSearch,
  mergeInboxMessages, orderInbox
} from './inbox.model';
import { CommunityService } from '../../services/community.service';
import { CommunityGroupsService } from '../../services/community-groups.service';
import { SessionService } from '../../services/session.service';
import { DirectChatService } from '../../services/direct-chat.service';
import { CommunityTimelineService } from '../../services/community-timeline.service';
import { DirectChatRealtimeService } from '../../services/direct-chat-realtime.service';

const item = (kind: 'direct' | 'community' | 'session', id: string | number): InboxConversation => ({
  kind, id, key: inboxKey(kind, id), title: String(id), subtitle: '', newThisVisit: 0
});
const message = (key: string, id: number, sender = 'beta'): InboxMessage => ({
  key, id, sender, text: 'Mensagem ' + id, createdAt: '2026-10-23T09:00:00Z'
});

describe('Unified Jynlo message center', () => {
  let component: MessagesCenterComponent;
  let friends: jasmine.SpyObj<CommunityService>;
  let communities: jasmine.SpyObj<CommunityGroupsService>;
  let sessions: jasmine.SpyObj<SessionService>;
  let direct: jasmine.SpyObj<DirectChatService>;
  let timeline: jasmine.SpyObj<CommunityTimelineService>;
  let realtime: DirectChatRealtimeService;
  const directEvents = new Subject<any>();
  const communityEvents = new Subject<any>();
  const sessionEvents = new Subject<any>();
  const connected = new BehaviorSubject<boolean>(false);

  beforeEach(() => {
    friends = jasmine.createSpyObj('CommunityService', ['friends']);
    communities = jasmine.createSpyObj('CommunityGroupsService', ['mine']);
    sessions = jasmine.createSpyObj('SessionService', ['mine', 'messages']);
    direct = jasmine.createSpyObj('DirectChatService', ['recentHistory']);
    timeline = jasmine.createSpyObj('CommunityTimelineService', ['list']);
    realtime = {
      messages$: directEvents.asObservable(),
      communityMessages$: communityEvents.asObservable(),
      sessionMessages$: sessionEvents.asObservable(),
      connected$: connected.asObservable(),
      connect: jasmine.createSpy('connect')
    } as unknown as DirectChatRealtimeService;
    friends.friends.and.returnValue(of([]));
    communities.mine.and.returnValue(of([]));
    sessions.mine.and.returnValue(of({ created: [], joined: [], waitlisted: [] }));
    component = new MessagesCenterComponent(friends, communities, sessions, direct, timeline, realtime);
    (component as any).currentUsername = 'ana';
  });

  it('shows friends, membership communities and confirmed sessions without N+1 histories', () => {
    friends.friends.and.returnValue(of([{ username: 'Bea', nickname: 'Bia', fullName: null, profilePicUrl: null, chatBlocked: false, blockedByMe: false }]));
    communities.mine.and.returnValue(of([{ id: 7, name: 'CNG', sport: 'Futsal' }] as any));
    sessions.mine.and.returnValue(of({
      created: [{ id: 41, sport: 'Ténis', city: 'Cacém', gameDate: '2026-11-01T10:00:00Z' }],
      joined: [{ id: 41, sport: 'Ténis', city: 'Cacém', gameDate: '2026-11-01T10:00:00Z' }],
      waitlisted: [{ id: 99, sport: 'Futebol', city: 'Lisboa', gameDate: '2026-11-01T10:00:00Z' }]
    } as any));
    component.loadInbox();
    expect(component.conversations.map(x => x.key).sort()).toEqual([
      'community:7', 'direct:bea', 'session:41'
    ]);
    expect(component.selectedKey).toBeNull();
    expect(direct.recentHistory).not.toHaveBeenCalled();
    expect(timeline.list).not.toHaveBeenCalled();
    expect(sessions.messages).not.toHaveBeenCalled();
  });

  it('keeps partial results when one category fails', () => {
    friends.friends.and.returnValue(throwError(() => new Error('offline')));
    communities.mine.and.returnValue(of([{ id: 7, name: 'CNG' }] as any));
    component.loadInbox();
    expect(component.sourceError).toBeTrue();
    expect(component.failedSources).toEqual(['direct']);
    expect(component.conversations.map(x => x.key)).toEqual(['community:7']);
  });

  it('drops stale history from a previous selection, even after switching types', () => {
    const old = new Subject<any[]>();
    const newer = new Subject<any>();
    component.conversations = [item('community', 7), item('direct', 'bea')];
    timeline.list.and.returnValue(old.asObservable());
    direct.recentHistory.and.returnValue(newer.asObservable());
    component.selectConversation(component.conversations[0]);
    component.selectConversation(component.conversations[1]);
    old.next([{ id: 31, communityId: 7, kind: 'CHAT', username: 'ana', body: 'Antiga', createdAt: '2026-10-20T10:00:00Z' }]);
    newer.next({ last: true, content: [{ id: 32, username1: 'bea', username2: 'ana', text: 'Olá', date: '2026-10-23T09:00:00Z', dataDisplay: null }] });
    expect(component.messages.map(x => x.id)).toEqual([32]);
    expect(component.selectedKey).toBe('direct:bea');
  });

  it('reconciles live messages with a pending HTTP response without duplicating IDs', () => {
    const delayed = new Subject<any[]>();
    const community = item('community', 7);
    component.conversations = [community];
    timeline.list.and.returnValue(delayed.asObservable());
    component.selectConversation(community);
    (component as any).acceptRealtime('community:7', message('community:7', 8));
    (component as any).acceptRealtime('community:7', message('community:7', 8));
    delayed.next([{ id: 7, communityId: 7, kind: 'CHAT', username: 'ana', body: 'Anterior', createdAt: '2026-10-23T08:00:00Z' }]);
    expect(component.messages.map(x => x.id)).toEqual([7, 8]);
    expect(component.recentCount).toBe(0);
  });

  it('counts only incoming messages for other conversations during this visit', () => {
    component.conversations = [item('direct', 'bea'), item('community', 7)];
    component.selectedKey = 'community:7';
    (component as any).acceptRealtime('direct:bea', message('direct:bea', 4, 'Bea'));
    (component as any).acceptRealtime('direct:bea', message('direct:bea', 4, 'Bea'));
    (component as any).acceptRealtime('direct:bea', message('direct:bea', 5, 'ana'));
    (component as any).acceptRealtime('community:999', message('community:999', 6));
    expect(component.recentCount).toBe(1);
    expect(component.conversations.find(x => x.key === 'direct:bea')?.newThisVisit).toBe(1);
    direct.recentHistory.and.returnValue(of({ content: [], last: true }));
    component.selectConversation(component.conversations.find(x => x.key === 'direct:bea')!);
    expect(component.recentCount).toBe(0);
  });

  it('keeps links scoped to the original authorized chat screens', () => {
    expect(component.conversationLink(item('direct', 'Bea'))).toEqual(['/menu/friendList/chat', 'Bea']);
    expect(component.conversationLink(item('community', 7))).toEqual(['/menu/communities', 7]);
    expect(component.conversationQuery(item('community', 7))).toEqual({ tab: 'chat' });
    expect(component.conversationLink(item('session', 14))).toEqual(['/menu/events', 14]);
    expect(component.conversationQuery(item('session', 14))).toEqual({ chat: '1' });
  });

  it('normalizes case and accents in search and deduplicates history by ID', () => {
    expect(inboxKey('direct', 'BÉA')).toBe('direct:béa');
    const match = { ...item('community', 7), title: 'Futebol Cacém' };
    expect(matchesInboxSearch(match, 'CACEM')).toBeTrue();
    expect(matchesInboxSearch(match, 'Ténis')).toBeFalse();
    expect(mergeInboxMessages([message('community:7', 9), message('community:7', 8),
      message('community:7', 9)]).map(x => x.id)).toEqual([8, 9]);
    expect(orderInbox([
      { ...item('session', 1), latestAt: '2026-10-22T00:00:00Z' },
      { ...item('direct', 'bea'), latestAt: '2026-10-23T00:00:00Z' }
    ])[0].key).toBe('direct:bea');
  });
});
