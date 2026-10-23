import { of, Subject, throwError, BehaviorSubject } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
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
import { InboxApiService } from '../../services/inbox-api.service';

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
  let inboxApi: jasmine.SpyObj<InboxApiService>;
  const directEvents = new Subject<any>();
  const communityEvents = new Subject<any>();
  const sessionEvents = new Subject<any>();
  const connected = new BehaviorSubject<boolean>(false);

  beforeEach(() => {
    // The default inbox tests exercise foreground user interactions. Hidden
    // document cases are explicitly covered in the receipt-specific suite.
    spyOn(document, 'hasFocus').and.returnValue(true);
    spyOnProperty(document, 'visibilityState', 'get').and.returnValue('visible');
    friends = jasmine.createSpyObj('CommunityService', ['friends']);
    communities = jasmine.createSpyObj('CommunityGroupsService', ['mine']);
    sessions = jasmine.createSpyObj('SessionService', ['mine', 'messages', 'detail', 'postMessage']);
    direct = jasmine.createSpyObj('DirectChatService', ['recentHistory', 'info', 'send']);
    timeline = jasmine.createSpyObj('CommunityTimelineService', ['list', 'send']);
    realtime = {
      messages$: directEvents.asObservable(),
      communityMessages$: communityEvents.asObservable(),
      sessionMessages$: sessionEvents.asObservable(),
      connected$: connected.asObservable(),
      connect: jasmine.createSpy('connect')
    } as unknown as DirectChatRealtimeService;
    inboxApi = jasmine.createSpyObj<InboxApiService>('InboxApiService', ['summaries', 'markRead', 'searchMessages', 'messageContext', 'directReadReceipt']);
    inboxApi.summaries.and.returnValue(of([]));
    inboxApi.directReadReceipt.and.callFake(peer => of({
      peerUsername: peer, lastReadMessageId: 0
    }));
    inboxApi.markRead.and.callFake(ref => of({ ...ref, latestMessageId: null,
      latestText: null, latestSender: null, latestAt: null, unreadCount: 0 }));
    friends.friends.and.returnValue(of([]));
    communities.mine.and.returnValue(of([]));
    sessions.mine.and.returnValue(of({ created: [], joined: [], waitlisted: [] }));
    direct.info.and.returnValue(of({ chatBlocked: false, whoBlocked: null }));
    sessions.detail.and.returnValue(of({
      id: 41, sport: 'Futsal', city: 'Cacém', gameDate: '2026-11-01T10:00:00Z',
      joined: true, status: 'OPEN'
    } as any));
    component = new MessagesCenterComponent(friends, communities, sessions, direct, timeline, realtime, inboxApi);
    (component as any).currentUsername = 'ana';
    // Older isolated tests construct a session chat without calling loadInbox().
    (component as any).sessionKickoffs.set(41, Date.now() + 3600_000);
  });

  it('searches full chat history through an authorized scoped request without marking read', () => {
    const selected = item('direct', 'bea');
    component.conversations = [selected];
    component.selectedKey = selected.key;
    component.messageSearchOpen = true;
    component.messageSearchTerm = 'torneio';
    inboxApi.searchMessages.and.returnValue(of({
      page: 0, hasMore: false, results: [{ id: 7, sender: 'bea', text: 'Torneio antigo',
        createdAt: '2026-09-01T12:00:00Z', replyToMessageId: 3,
        replyToSender: 'ana', replyToText: 'Um torneio?' }]
    }));
    component.submitMessageSearch();
    expect(inboxApi.searchMessages).toHaveBeenCalledOnceWith(
      { kind: 'direct', id: 'bea' }, 'torneio', 0);
    expect(component.messageSearchResults[0]).toEqual(jasmine.objectContaining({
      id: 7, text: 'Torneio antigo', replyToMessageId: 3
    }));
    expect(inboxApi.markRead).not.toHaveBeenCalled();
  });

  it('keeps scroll position and unread state while an earlier message is being read', () => {
    const conversation = item('direct', 'bea');
    component.conversations = [conversation];
    component.selectedKey = conversation.key;
    component.messages = [message(conversation.key, 20), message(conversation.key, 21)];
    const log = { scrollHeight: 1000, scrollTop: 100, clientHeight: 280 };
    component.previewLog = { nativeElement: log } as any;

    (component as any).acceptRealtime(conversation.key, message(conversation.key, 22, 'bea'));
    component.ngAfterViewChecked();
    expect(component.messages.map(x => x.id)).toEqual([20, 21, 22]);
    expect(log.scrollTop).toBe(100);
    expect(inboxApi.markRead).not.toHaveBeenCalled();

    // Returning manually to the bottom may now acknowledge the new message.
    log.scrollTop = 720;
    component.onPreviewLogScroll();
    expect(inboxApi.markRead).toHaveBeenCalledOnceWith(
      { kind: 'direct', id: 'bea' }, 22);
  });

  it('counts new remote arrivals while scrolled up and returns to the end only on request', () => {
    const conversation = item('direct', 'bea');
    component.conversations = [conversation];
    component.selectedKey = conversation.key;
    component.messages = [message(conversation.key, 1, 'ana')];
    const log = { scrollHeight: 1200, scrollTop: 100, clientHeight: 350 };
    component.previewLog = { nativeElement: log } as any;

    (component as any).acceptRealtime(conversation.key, message(conversation.key, 2, 'bea'));
    (component as any).acceptRealtime(conversation.key, message(conversation.key, 2, 'bea'));
    (component as any).acceptRealtime(conversation.key, message(conversation.key, 3, 'bea'));
    expect(component.newMessagesPending).toBe(2);
    expect(log.scrollTop).toBe(100);
    expect(inboxApi.markRead).not.toHaveBeenCalled();

    component.jumpToLatestMessages();
    expect(log.scrollTop).toBe(1200);
    expect(component.newMessagesPending).toBe(0);
    expect(inboxApi.markRead).toHaveBeenCalledOnceWith(
      { kind: 'direct', id: 'bea' }, 3);
  });

  it('does not display a new-arrival jump within a detached historical search window', () => {
    const selected = item('community', 7);
    component.conversations = [selected];
    component.selectedKey = selected.key;
    component.historicalPreview = true;
    component.newMessagesPending = 0;
    component.messages = [message(selected.key, 2, 'ana')];
    (component as any).acceptRealtime(selected.key, message(selected.key, 30, 'bea'));
    expect(component.newMessagesPending).toBe(0);
    expect(component.messages.map(item => item.id)).toEqual([2]);
    component.jumpToLatestMessages();
    expect(inboxApi.markRead).not.toHaveBeenCalled();
  });

  it('locates an already loaded search result without rewriting or marking chat history as read', () => {
    const selected = item('direct', 'bea');
    component.conversations = [selected];
    component.selectedKey = selected.key;
    component.messages = [message(selected.key, 4), message(selected.key, 9)];
    component.messageSearchResults = [message(selected.key, 4)];
    const focus = jasmine.createSpy('focus');
    const scrollIntoView = jasmine.createSpy('scrollIntoView');
    component.previewLog = { nativeElement: {
      querySelector: (_: string) => ({ focus, scrollIntoView })
    }} as any;
    component.viewMessageSearchResult(component.messageSearchResults[0]);
    expect(component.selectedSearchResultId).toBe(4);
    expect(component.searchResultNotInPreview).toBeFalse();
    expect(scrollIntoView).toHaveBeenCalled();
    expect(focus).toHaveBeenCalled();
    expect(component.messages.map(x => x.id)).toEqual([4, 9]);
    expect(inboxApi.markRead).not.toHaveBeenCalled();
  });

  it('keeps an older hit in search results rather than inserting it into recent history', () => {
    const selected = item('community', 7);
    component.conversations = [selected];
    component.selectedKey = selected.key;
    component.messages = [message(selected.key, 70), message(selected.key, 71)];
    component.messageSearchResults = [message(selected.key, 5)];
    const delayed = new Subject<any[]>();
    inboxApi.messageContext.and.returnValue(delayed.asObservable());
    component.viewMessageSearchResult(component.messageSearchResults[0]);
    expect(inboxApi.messageContext).toHaveBeenCalledOnceWith({ kind: 'community', id: '7' }, 5);
    expect(component.selectedSearchResultId).toBe(5);
    expect(component.searchResultNotInPreview).toBeTrue();
    expect(component.messages.map(x => x.id)).toEqual([70, 71]);
    delayed.next([{ id: 4, sender: 'ana', text: 'Antes', createdAt: null },
      { id: 5, sender: 'bea', text: 'Mensagem antiga', createdAt: null },
      { id: 6, sender: 'ana', text: 'Depois', createdAt: null }]);
    delayed.complete();
    expect(component.historicalPreview).toBeTrue();
    expect(component.messages.map(x => x.id)).toEqual([4, 5, 6]);
    expect(inboxApi.markRead).not.toHaveBeenCalled();
    component.viewMessageSearchResult(message('session:7', 99));
    expect(component.selectedSearchResultId).toBe(5);
    component.onMessageSearchTermChange();
    expect(component.selectedSearchResultId).toBeNull();
    expect(component.searchResultNotInPreview).toBeFalse();
  });


  it('does not join live socket messages into a historical window or mark them read', () => {
    const selected = item('session', 41);
    component.conversations = [selected];
    component.selectedKey = selected.key;
    component.historicalPreview = true;
    component.messages = [message(selected.key, 5)];
    (component as any).acceptRealtime(selected.key, message(selected.key, 90, 'bea'));
    expect(component.messages.map(x => x.id)).toEqual([5]);
    expect(inboxApi.markRead).not.toHaveBeenCalled();
    expect(component.conversations[0].newThisVisit).toBe(1);
  });

  it('ignores a delayed historical context after switching conversation', () => {
    const old = item('community', 7), next = item('direct', 'bea');
    component.conversations = [old, next];
    component.selectedKey = old.key;
    component.messageSearchResults = [message(old.key, 5)];
    const pending = new Subject<any[]>();
    inboxApi.messageContext.and.returnValue(pending.asObservable());
    direct.recentHistory.and.returnValue(of({ content: [], last: true }));
    component.viewMessageSearchResult(component.messageSearchResults[0]);
    component.selectConversation(next);
    pending.next([{ id: 5, sender: 'bea', text: 'old', createdAt: null }]);
    pending.complete();
    expect(component.selectedKey).toBe(next.key);
    expect(component.historicalPreview).toBeFalse();
    expect(component.messages).toEqual([]);
  });

  it('refuses a mismatched context and keeps recent messages intact', () => {
    const selected = item('direct', 'bea');
    component.conversations = [selected];
    component.selectedKey = selected.key;
    component.messages = [message(selected.key, 80)];
    component.messageSearchResults = [message(selected.key, 5)];
    inboxApi.messageContext.and.returnValue(of([
      { id: 7, sender: 'bea', text: 'other', createdAt: null }
    ]));
    component.viewMessageSearchResult(component.messageSearchResults[0]);
    expect(component.historyLocateError).toBeTrue();
    expect(component.historicalPreview).toBeFalse();
    expect(component.messages.map(m => m.id)).toEqual([80]);
  });

  it('loads additional pages newest first with no duplicate messages', () => {
    const selected = item('community', 7);
    component.conversations = [selected];
    component.selectedKey = selected.key;
    component.messageSearchOpen = true;
    component.messageSearchTerm = 'treino';
    inboxApi.searchMessages.and.returnValues(
      of({ page: 0, hasMore: true, results: [{ id: 30, sender: 'ana',
        text: 'Treino recente', createdAt: '2026-10-23T10:00:00Z' }] }),
      of({ page: 1, hasMore: false, results: [
        { id: 30, sender: 'ana', text: 'Treino recente', createdAt: '2026-10-23T10:00:00Z' },
        { id: 9, sender: 'bea', text: 'Treino antigo', createdAt: '2026-08-15T10:00:00Z' }
      ] })
    );
    component.submitMessageSearch();
    component.submitMessageSearch(1);
    expect(component.messageSearchResults.map(m => m.id)).toEqual([30, 9]);
    expect(component.messageSearchHasMore).toBeFalse();
    expect(inboxApi.searchMessages).toHaveBeenCalledTimes(2);
  });

  it('discards search results after switching conversations or changing the query', () => {
    const older = new Subject<any>();
    const selected = item('session', 41);
    component.conversations = [selected, item('direct', 'bea')];
    component.selectedKey = selected.key;
    component.messageSearchOpen = true;
    component.messageSearchTerm = 'golo';
    inboxApi.searchMessages.and.returnValue(older.asObservable());
    component.submitMessageSearch();
    component.messageSearchTerm = 'jogo';
    component.onMessageSearchTermChange();
    older.next({ page: 0, hasMore: false, results: [
      { id: 33, sender: 'ana', text: 'golo', createdAt: null }
    ] });
    older.complete();
    expect(component.messageSearchResults).toEqual([]);
    expect(component.messageSearchLoading).toBeFalse();
    expect(component.messageSearchSearched).toBeFalse();
    component.toggleMessageSearch();
    expect(component.messageSearchOpen).toBeFalse();
  });

  it('refuses short searches and does not quote historical results from another chat', () => {
    const selected = item('direct', 'bea');
    component.conversations = [selected];
    component.selectedKey = selected.key;
    component.messageSearchOpen = true;
    component.messageSearchTerm = 'a';
    component.submitMessageSearch();
    expect(inboxApi.searchMessages).not.toHaveBeenCalled();
    component.composerAllowed = true;
    component.replyToMessage(message('community:7', 11));
    expect(component.replyingTo).toBeNull();
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

  it('lists only upcoming session conversations and opens a linked authorized session', () => {
    const active = new Date(Date.now() + 3600_000).toISOString();
    const past = new Date(Date.now() - 3600_000).toISOString();
    sessions.mine.and.returnValue(of({ created: [
      { id: 14, gameDate: active, status: 'OPEN', sport: 'Futebol', city: 'Lisboa' },
      { id: 15, gameDate: past, status: 'OPEN', sport: 'Padel', city: 'Lisboa' },
      { id: 16, gameDate: active, status: 'CANCELLED', sport: 'Padel', city: 'Lisboa' }
    ], joined: [], waitlisted: [] } as any));
    sessions.messages.and.returnValue(of([]));
    component = new MessagesCenterComponent(friends, communities, sessions, direct, timeline,
      realtime, inboxApi, { snapshot: { queryParamMap: { get: (key: string) =>
        key === 'kind' ? 'session' : key === 'id' ? '14' : null } } } as any);
    component.loadInbox();
    expect(component.conversations.filter(c => c.kind === 'session').map(c => c.id)).toEqual([14]);
    expect(component.selectedKey).toBe('session:14');
    expect(sessions.messages).toHaveBeenCalledWith(14);
  });

  it('handles query-param changes without reopening a manually selected conversation', () => {
    const params = new BehaviorSubject<{ get: (key: string) => string | null }>({
      get: (key: string) => key === 'kind' ? 'direct' : key === 'id' ? 'bea' : null
    });
    friends.friends.and.returnValue(of([
      { username: 'bea', fullName: 'Bea' }, { username: 'ana', fullName: 'Ana' }
    ] as any));
    direct.recentHistory.and.returnValue(of({ content: [], last: true } as any));
    component = new MessagesCenterComponent(friends, communities, sessions, direct, timeline,
      realtime, inboxApi, { queryParamMap: params.asObservable() } as any);
    component.ngOnInit();
    expect(component.selectedKey).toBe('direct:bea');
    params.next({ get: key => key === 'kind' ? 'direct' : key === 'id' ? 'ana' : null });
    expect(component.selectedKey).toBe('direct:ana');
    component.selectConversation(component.conversations.find(item => item.key === 'direct:bea')!);
    component.loadInbox();
    expect(component.selectedKey).toBe('direct:bea');
    component.ngOnDestroy();
  });

  it('enforces kickoff in the message center even if access was cached', () => {
    const current = item('session', 14);
    component.conversations = [current];
    component.selectedKey = current.key;
    component.composerAllowed = true;
    component.draft = 'Olá';
    (component as any).sessionKickoffs.set(14, Date.now() - 1000);
    expect(component.isSelectedSessionOpen()).toBeFalse();
    expect(component.canSendMessage()).toBeFalse();
    (component as any).sessionKickoffs.set(14, Date.now() + 3600_000);
    expect(component.isSelectedSessionOpen()).toBeTrue();
    expect(component.canSendMessage()).toBeTrue();
  });

  it('does not invent a conversation from a forged or expired deep link', () => {
    component = new MessagesCenterComponent(friends, communities, sessions, direct, timeline,
      realtime, inboxApi, { snapshot: { queryParamMap: { get: (key: string) =>
        key === 'kind' ? 'session' : key === 'id' ? '999' : null } } } as any);
    component.loadInbox();
    expect(component.selectedKey).toBeNull();
    expect(sessions.messages).not.toHaveBeenCalled();
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

  it('sorts a live message without a timestamp after older history using the persisted ID', () => {
    const key = 'direct:bea';
    const history = message(key, 10, 'bea');
    const live = { ...message(key, 12, 'bea'), createdAt: '' };
    const result = mergeInboxMessages([live, history]);
    expect(result.map(entry => entry.id)).toEqual([10, 12]);
    // No timestamp is invented; the backend record remains authoritative.
    expect(result[1].createdAt).toBe('');
  });

  it('sends a community reply once and reconciles WebSocket before HTTP success', () => {
    const selected = item('community', 7);
    component.conversations = [selected];
    timeline.list.and.returnValue(of([]));
    const post = new Subject<any>();
    timeline.send.and.returnValue(post.asObservable());
    component.selectConversation(selected);
    component.draft = '  Vamos jogar?  ';
    component.sendMessage();
    expect(timeline.send).toHaveBeenCalledOnceWith(7, 'CHAT', 'Vamos jogar?');
    expect(component.sending).toBeTrue();
    component.sendMessage();
    expect(timeline.send).toHaveBeenCalledTimes(1);
    const saved = { id: 80, communityId: 7, kind: 'CHAT', username: 'ana',
      body: 'Vamos jogar?', createdAt: new Date().toISOString() };
    (component as any).acceptRealtime('community:7', {
      key: 'community:7', id: 80, sender: 'ana', text: 'Vamos jogar?', createdAt: saved.createdAt
    });
    post.next(saved);
    post.complete();
    expect(component.messages.map(x => x.id)).toEqual([80]);
    expect(component.draft).toBe('');
    expect(component.sending).toBeFalse();
  });

  it('restores composer focus at submit and does not refocus asynchronously on delivery', () => {
    const selected = item('direct', 'bea');
    component.conversations = [selected];
    direct.recentHistory.and.returnValue(of({ content: [], last: true }));
    const send = new Subject<any>();
    direct.send.and.returnValue(send.asObservable());
    component.selectConversation(selected);
    component.draft = 'Olá novamente';

    const focus = jasmine.createSpy('focus');
    component.composerTextarea = { nativeElement: { focus } } as any;
    component.sendMessage();
    expect(focus).toHaveBeenCalledOnceWith({ preventScroll: true });
    expect(component.sending).toBeTrue();

    component.sendMessage();
    expect(direct.send).toHaveBeenCalledTimes(1);
    send.next({ id: 83, username1: 'ana', username2: 'bea', text: 'Olá novamente',
      date: new Date().toISOString(), dataDisplay: null });
    send.complete();
    expect(component.sending).toBeFalse();
    expect(component.draft).toBe('');
    expect(focus).toHaveBeenCalledTimes(1);
  });

  it('quotes a private message by ID and keeps its server snapshot when showing history', () => {
    const selected = item('direct', 'bea');
    component.conversations = [selected];
    direct.recentHistory.and.returnValue(of({ last: true, content: [{
      id: 12, username1: 'bea', username2: 'ana', text: 'Tudo bem?',
      date: '2026-10-23T09:00:00Z', dataDisplay: null
    }] }));
    component.selectConversation(selected);
    expect(component.messages[0].id).toBe(12);
    component.replyToMessage(component.messages[0]);
    expect(component.replyingTo?.id).toBe(12);
    component.draft = 'Sim!';
    direct.send.and.returnValue(of({ id: 13, username1: 'ana', username2: 'bea',
      text: 'Sim!', date: '2026-10-23T09:01:00Z', dataDisplay: null,
      replyToMessageId: 12, replyToSender: 'bea', replyToText: 'Tudo bem?' }));
    component.sendMessage();
    expect(direct.send).toHaveBeenCalledOnceWith('bea', 'Sim!', 12);
    expect(component.replyingTo).toBeNull();
    expect(component.messages.find(m => m.id === 13)).toEqual(jasmine.objectContaining({
      replyToMessageId: 12, replyToSender: 'bea', replyToText: 'Tudo bem?'
    }));
  });

  it('quotes a community message and sends its ID without exposing a direct chat payload', () => {
    const selected = item('community', 7);
    component.conversations = [selected];
    timeline.list.and.returnValue(of([
      { id: 10, communityId: 7, kind: 'CHAT', username: 'bea',
        body: 'Vamos jogar?', createdAt: '2026-10-23T09:00:00Z' }
    ]));
    component.selectConversation(selected);
    component.replyToMessage(component.messages[0]);
    expect(component.replyingTo?.id).toBe(10);
    component.draft = 'Sim!';
    timeline.send.and.returnValue(of({ id: 11, communityId: 7, kind: 'CHAT',
      username: 'ana', body: 'Sim!', createdAt: '2026-10-23T09:01:00Z',
      replyToMessageId: 10, replyToSender: 'bea', replyToText: 'Vamos jogar?' }));
    component.sendMessage();
    expect(timeline.send).toHaveBeenCalledOnceWith(7, 'CHAT', 'Sim!', 10);
    expect(component.replyingTo).toBeNull();
    expect(component.messages.find(m => m.id === 11)?.replyToText).toBe('Vamos jogar?');
  });

  it('quotes a session message and clears it when another conversation is selected', () => {
    const session = item('session', 41);
    const directChat = item('direct', 'bea');
    component.conversations = [session, directChat];
    sessions.messages.and.returnValue(of([
      { id: 33, sessionId: 41, senderUsername: 'bea', body: 'Traz uma bola?',
        createdAt: '2026-10-23T09:00:00Z' }
    ]));
    sessions.detail.and.returnValue(of({ id: 41, status: 'OPEN', joined: true,
      gameDate: new Date(Date.now() + 3600_000).toISOString() } as any));
    component.selectConversation(session);
    component.replyToMessage(component.messages[0]);
    component.draft = 'Combinado';
    sessions.postMessage.and.returnValue(of({ id: 34, sessionId: 41,
      senderUsername: 'ana', body: 'Combinado', createdAt: new Date().toISOString(),
      replyToMessageId: 33, replyToSender: 'bea', replyToText: 'Traz uma bola?' }));
    component.sendMessage();
    expect(sessions.postMessage).toHaveBeenCalledOnceWith(41, 'Combinado', 33);
    expect(component.replyingTo).toBeNull();
    direct.recentHistory.and.returnValue(of({ last: true, content: [] }));
    component.selectConversation(directChat);
    expect(component.replyingTo).toBeNull();
  });

  it('does not POST direct messages when the original chat is blocked', () => {
    const selected = item('direct', 'bea');
    component.conversations = [selected];
    direct.recentHistory.and.returnValue(of({ last: true, content: [] }));
    direct.info.and.returnValue(of({ chatBlocked: true, whoBlocked: 'bea' }));
    component.selectConversation(selected);
    component.draft = 'Olá';
    expect(component.canSendMessage()).toBeFalse();
    component.sendMessage();
    expect(direct.send).not.toHaveBeenCalled();
  });

  it('does not POST to completed sessions or to a session without membership', () => {
    const selected = item('session', 41);
    component.conversations = [selected];
    sessions.messages.and.returnValue(of([]));
    sessions.detail.and.returnValue(of({ id: 41, status: 'COMPLETED', joined: true,
      gameDate: '2026-11-01T10:00:00Z' } as any));
    component.selectConversation(selected);
    component.draft = 'Olá';
    expect(component.canSendMessage()).toBeFalse();
    expect(sessions.postMessage).not.toHaveBeenCalled();
  });

  it('preserves an uncertain draft and blocks re-sends after network timeout', () => {
    const selected = item('community', 7);
    component.conversations = [selected];
    timeline.list.and.returnValue(of([]));
    timeline.send.and.returnValue(throwError(() => new HttpErrorResponse({ status: 0 })));
    component.selectConversation(selected);
    component.draft = '  Bora! ';
    component.sendMessage();
    expect(component.deliveryUncertain).toBeTrue();
    expect(component.draft).toBe('  Bora! ');
    component.sendMessage();
    expect(timeline.send).toHaveBeenCalledTimes(1);
    component.resumeAfterUncertainSend();
    expect(component.deliveryUncertain).toBeFalse();
    expect(component.draft).toBe('  Bora! ');
  });

  it('confirms a successful session POST after a lost HTTP response without a second POST', () => {
    const selected = item('session', 41);
    component.conversations = [selected];
    sessions.messages.and.returnValues(of([]), of([{
      id: 33, sessionId: 41, senderUsername: 'ana', body: 'Até logo',
      createdAt: new Date().toISOString()
    }]));
    sessions.detail.and.returnValue(of({ id: 41, status: 'OPEN', joined: true,
      gameDate: new Date(Date.now() + 60_000).toISOString() } as any));
    sessions.postMessage.and.returnValue(throwError(() => new HttpErrorResponse({ status: 503 })));
    component.selectConversation(selected);
    component.draft = 'Até logo';
    component.sendMessage();
    expect(sessions.postMessage).toHaveBeenCalledOnceWith(41, 'Até logo');
    expect(component.deliveryUncertain).toBeFalse();
    expect(component.draft).toBe('');
    expect(component.messages.map(m => m.id)).toEqual([33]);
  });

  it('retains pending drafts per conversation but never sends while ambiguous', () => {
    const community = item('community', 7);
    const directChat = item('direct', 'bea');
    component.conversations = [community, directChat];
    timeline.list.and.returnValue(of([]));
    timeline.send.and.returnValue(throwError(() => new HttpErrorResponse({ status: 408 })));
    direct.recentHistory.and.returnValue(of({ last: true, content: [] }));
    component.selectConversation(community);
    component.draft = 'Pendente';
    component.sendMessage();
    expect(component.deliveryUncertain).toBeTrue();
    component.selectConversation(directChat);
    component.draft = 'Uma conversa diferente';
    component.selectConversation(community);
    expect(component.deliveryUncertain).toBeTrue();
    expect(component.draft).toBe('Pendente');
    component.sendMessage();
    expect(timeline.send).toHaveBeenCalledTimes(1);
  });

  it('allows Shift+Enter and composition without triggering send', () => {
    const evt = new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, cancelable: true });
    component.onComposerEnter(evt);
    expect(evt.defaultPrevented).toBeFalse();
    const ime = new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, cancelable: true });
    component.onComposerEnter(ime);
    expect(ime.defaultPrevented).toBeFalse();
    expect(timeline.send).not.toHaveBeenCalled();
  });


  it('renders persistent unread badge text instead of local visit count', () => {
    const remoteUnread = { ...item('direct', 'bea'), unreadCount: 12, newThisVisit: 0 };
    expect(component.unreadCountFor(remoteUnread)).toBe(12);
    expect(component.unreadBadgeText(remoteUnread)).toBe('12');
    const many = { ...remoteUnread, unreadCount: 142 };
    expect(component.unreadBadgeText(many)).toBe('99+');
    const localFallback = { ...item('direct', 'bea'), newThisVisit: 3 };
    expect(component.unreadBadgeText(localFallback)).toBe('3');
    component.conversations = [remoteUnread];
    component.setFilter('recent');
    expect(component.filteredConversations).toEqual([remoteUnread]);
    expect(component.recentCount).toBe(12);
  });

  it('hydrates previews and unread counts from authenticated server snapshots without fetching chat histories', () => {
    friends.friends.and.returnValue(of([{ username: 'bea', fullName: null, nickname: null,
      profilePicUrl: null, chatBlocked: false, blockedByMe: false }]));
    inboxApi.summaries.and.returnValue(of([{
      kind: 'direct', id: 'bea', latestMessageId: 70, latestText: 'Vamos jogar?',
      latestSender: 'bea', latestAt: '2026-10-23T09:00:00Z', unreadCount: 4
    }]));
    component.loadInbox();
    expect(component.conversations[0].latestText).toBe('Vamos jogar?');
    expect(component.recentCount).toBe(4);
    component.setFilter('recent');
    expect(component.filteredConversations.map(x => x.key)).toEqual(['direct:bea']);
    expect(direct.recentHistory).not.toHaveBeenCalled();
  });

  it('persists a read cursor after authorized history loads and clears the unread badge', () => {
    const community = item('community', 7);
    community.unreadCount = 5;
    component.conversations = [community];
    timeline.list.and.returnValue(of([{ id: 75, communityId: 7, kind: 'CHAT',
      username: 'bea', body: 'Olá', createdAt: '2026-10-23T09:00:00Z' }]));
    inboxApi.markRead.and.returnValue(of({
      kind: 'community', id: '7', latestMessageId: 75, latestText: 'Olá',
      latestSender: 'bea', latestAt: '2026-10-23T09:00:00Z', unreadCount: 0
    }));
    component.selectConversation(community);
    expect(inboxApi.markRead).toHaveBeenCalledOnceWith(
      { kind: 'community', id: '7' }, 75);
    expect(component.recentCount).toBe(0);
  });

  it('never persists read on HTTP forbidden or failed preview', () => {
    const community = item('community', 7);
    component.conversations = [community];
    timeline.list.and.returnValue(throwError(() => new Error('403')));
    component.selectConversation(community);
    expect(inboxApi.markRead).not.toHaveBeenCalled();
    expect(component.previewError).toBeTrue();
  });

  it('retains locally newer socket activity when a snapshot arrives late', () => {
    const community = item('community', 7);
    component.conversations = [community];
    const pending = new Subject<any>();
    inboxApi.summaries.and.returnValue(pending.asObservable());
    component.refreshSummaries();
    (component as any).acceptRealtime('community:7', {
      key: 'community:7', id: 80, sender: 'bea', text: 'Nova',
      createdAt: '2026-10-23T10:00:00Z'
    });
    pending.next([{ kind: 'community', id: '7', latestMessageId: 79,
      latestText: 'Antiga', latestSender: 'ana',
      latestAt: '2026-10-23T09:00:00Z', unreadCount: 1 }]);
    pending.complete();
    expect(component.conversations[0].latestText).toBe('Nova');
    expect(component.conversations[0].unreadCount).toBe(1);
  });

});

describe('Direct chat confirmed read status', () => {
  // Intentionally tested without a DOM renderer: these are authorization
  // and state-race contracts for the inbox, not visual snapshot tests.
  let inbox: MessagesCenterComponent;
  let api: jasmine.SpyObj<InboxApiService>;
  let direct: jasmine.SpyObj<DirectChatService>;
  let friends: jasmine.SpyObj<CommunityService>;
  let communities: jasmine.SpyObj<CommunityGroupsService>;
  let sessions: jasmine.SpyObj<SessionService>;
  let timeline: jasmine.SpyObj<CommunityTimelineService>;
  let realtime: DirectChatRealtimeService;
  let browserToken: string;

  beforeEach(() => {
    browserToken = 'fixture-auth-token-for-ana';
    spyOn(localStorage, 'getItem').and.callFake(key => key === 't' ? browserToken : null);
    // Make the background/read contract independent of the Karma runner's focus.
    spyOn(document, 'hasFocus').and.returnValue(true);
    spyOnProperty(document, 'visibilityState', 'get').and.returnValue('visible');
    friends = jasmine.createSpyObj('CommunityService', ['friends']);
    communities = jasmine.createSpyObj('CommunityGroupsService', ['mine']);
    sessions = jasmine.createSpyObj('SessionService', ['mine','messages','detail','postMessage']);
    direct = jasmine.createSpyObj('DirectChatService', ['recentHistory','info','send']);
    timeline = jasmine.createSpyObj('CommunityTimelineService', ['list','send']);
    api = jasmine.createSpyObj<InboxApiService>('InboxApiService',
      ['summaries','markRead','searchMessages','messageContext','directReadReceipt']);
    api.summaries.and.returnValue(of([]));
    api.directReadReceipt.and.callFake(peer=>of({peerUsername:peer,lastReadMessageId:0}));
    api.markRead.and.returnValue(of({kind:'direct',id:'bea',
      latestMessageId:null,latestText:null,latestAt:null,latestSender:null,unreadCount:0}));
    direct.recentHistory.and.returnValue(of({content:[],last:true} as any));
    direct.info.and.returnValue(of({chatBlocked:false,whoBlocked:null} as any));
    realtime = {connected$:new BehaviorSubject(false).asObservable(),
      messages$:new Subject<any>().asObservable(),
      communityMessages$:new Subject<any>().asObservable(),
      sessionMessages$:new Subject<any>().asObservable(),
      connect:()=>{}} as unknown as DirectChatRealtimeService;
    inbox = new MessagesCenterComponent(friends,communities,sessions,
      direct,timeline,realtime,api);
    (inbox as any).currentUsername = 'ana';
    (inbox as any).receiptSessionToken = browserToken;
  });

  function select(peer:string):void {
    const conversation={key:'direct:'+peer,kind:'direct' as const,
      id:peer,title:peer,subtitle:peer,newThisVisit:0};
    inbox.conversations=[conversation];
    inbox.selectConversation(conversation);
  }

  it('only marks persisted own private messages read when the peer cursor covers their ID',()=>{
    api.directReadReceipt.and.returnValue(of({peerUsername:'bea',lastReadMessageId:11}));
    select('bea');
    expect(inbox.isDirectMessageRead({key:'direct:bea',id:10,sender:'ana',
      text:'a',createdAt:''})).toBeTrue();
    expect(inbox.isDirectMessageRead({key:'direct:bea',id:12,sender:'ana',
      text:'b',createdAt:''})).toBeFalse();
    expect(inbox.isDirectMessageRead({key:'direct:bea',id:10,sender:'bea',
      text:'c',createdAt:''})).toBeFalse();
    expect(inbox.isDirectMessageRead({key:'direct:bea',id:0,sender:'ana',
      text:'unsaved',createdAt:''})).toBeFalse();
  });

  it('ignores a delayed response from a previous selected conversation',()=>{
    const slow=new Subject<{peerUsername:string;lastReadMessageId:number}>();
    api.directReadReceipt.and.callFake(peer => peer==='bea'
      ? slow.asObservable() : of({peerUsername:peer,lastReadMessageId:0}));
    select('bea');
    select('carla');
    slow.next({peerUsername:'bea',lastReadMessageId:999});
    slow.complete();
    expect(inbox.isDirectMessageRead({key:'direct:carla',id:10,
      sender:'ana',text:'not read',createdAt:''})).toBeFalse();
    expect(api.directReadReceipt).toHaveBeenCalledWith('bea');
    expect(api.directReadReceipt).toHaveBeenCalledWith('carla');
  });

  it('hides stale read receipts immediately if another tab replaces the login token',()=> {
    api.directReadReceipt.and.returnValue(of({peerUsername:'bea',lastReadMessageId:42}));
    select('bea');
    const own = {key:'direct:bea',id:42,sender:'ana',text:'hello',createdAt:''};
    expect(inbox.isDirectMessageRead(own)).toBeTrue();
    browserToken = 'fixture-token-from-another-account';
    expect(inbox.isDirectMessageRead(own)).toBeFalse();
    (inbox as any).refreshPeerReadReceipt(true);
    expect((inbox as any).peerReadCursor).toBeNull();
    expect(api.directReadReceipt).toHaveBeenCalledTimes(1);
  });

  it('never reuses a peer receipt for a message belonging to another conversation',()=> {
    api.directReadReceipt.and.returnValue(of({peerUsername:'bea',lastReadMessageId:42}));
    select('bea');
    expect(inbox.isDirectMessageRead({key:'direct:carla',id:40,sender:'ana',
      text:'other chat',createdAt:''})).toBeFalse();
  });

  it('does not acknowledge a read while the recipient tab is hidden or unfocused',()=> {
    select('bea');
    inbox.messages=[{key:'direct:bea',id:42,sender:'bea',
      text:'unread while away',createdAt:'2026-10-23T10:00:00Z'}];
    inbox.previewLog = {nativeElement:{scrollHeight:100,scrollTop:0,clientHeight:100}} as any;
    (document.hasFocus as jasmine.Spy).and.returnValue(false);
    (inbox as any).markRenderedRead('direct:bea', true);
    expect(api.markRead).not.toHaveBeenCalled();
    (document.hasFocus as jasmine.Spy).and.returnValue(true);
    (inbox as any).markRenderedRead('direct:bea', true);
    expect(api.markRead).toHaveBeenCalledOnceWith(
      {kind:'direct',id:'bea'},42);
  });

  it('stops receipt GET polling while inactive and refreshes on return',()=> {
    const clock=spyOn(Date,'now').and.returnValue(100_000);
    select('bea');
    expect(api.directReadReceipt).toHaveBeenCalledTimes(1);
    (document.hasFocus as jasmine.Spy).and.returnValue(false);
    clock.and.returnValue(116_000);
    (inbox as any).refreshPeerReadReceipt();
    expect(api.directReadReceipt).toHaveBeenCalledTimes(1);
    (document.hasFocus as jasmine.Spy).and.returnValue(true);
    (inbox as any).onPageActive();
    expect(api.directReadReceipt).toHaveBeenCalledTimes(2);
    clock.and.returnValue(130_999);
    (inbox as any).refreshPeerReadReceipt();
    expect(api.directReadReceipt).toHaveBeenCalledTimes(2);
    clock.and.returnValue(131_000);
    (inbox as any).refreshPeerReadReceipt();
    expect(api.directReadReceipt).toHaveBeenCalledTimes(3);
  });

  it('does not fetch a receipt or mark read if the document is hidden',()=> {
    select('bea');
    inbox.messages=[{key:'direct:bea',id:40,sender:'bea',text:'hidden',createdAt:''}];
    // The foreground visibility spy was installed by this suite's setup.
    const descriptor = Object.getOwnPropertyDescriptor(document, 'visibilityState');
    expect(descriptor?.get).toBeDefined();
    (descriptor!.get as jasmine.Spy).and.returnValue('hidden');
    (inbox as any).markRenderedRead('direct:bea', true);
    (inbox as any).refreshPeerReadReceipt(true);
    expect(api.markRead).not.toHaveBeenCalled();
    expect(api.directReadReceipt).toHaveBeenCalledTimes(1);
  });

  it('does not trust errors, wrong identities, or decreasing cursors',()=>{
    api.directReadReceipt.and.returnValue(of({peerUsername:'bea',lastReadMessageId:18}));
    select('bea');
    api.directReadReceipt.and.returnValue(of({peerUsername:'other',lastReadMessageId:999}));
    (inbox as any).refreshPeerReadReceipt(true);
    expect(inbox.isDirectMessageRead({key:'direct:bea',id:18,
      sender:'ana',text:'read',createdAt:''})).toBeTrue();
    expect(inbox.isDirectMessageRead({key:'direct:bea',id:19,
      sender:'ana',text:'unread',createdAt:''})).toBeFalse();
    api.directReadReceipt.and.returnValue(of({peerUsername:'bea',lastReadMessageId:5}));
    (inbox as any).refreshPeerReadReceipt(true);
    expect(inbox.isDirectMessageRead({key:'direct:bea',id:18,
      sender:'ana',text:'read',createdAt:''})).toBeTrue();
  });
});
