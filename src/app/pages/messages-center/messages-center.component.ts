import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, OnDestroy, OnInit, AfterViewChecked, ViewChild, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { JwtHelperService } from '@auth0/angular-jwt';
import { catchError, finalize, forkJoin, map, Observable, of, Subscription, TimeoutError, timeout } from 'rxjs';
import { appTranslate as t } from '../../i18n/i18n.service';
import { SessionDetail } from '../model/session-detail';
import { InboxApiService, InboxSummary } from '../../services/inbox-api.service';

import { TranslatePipe } from '../../i18n/translate.pipe';
import { CommunityService } from '../../services/community.service';
import { CommunityGroupsService } from '../../services/community-groups.service';
import { SessionService } from '../../services/session.service';
import { DirectChatService } from '../../services/direct-chat.service';
import { CommunityTimelineService } from '../../services/community-timeline.service';
import { DirectChatRealtimeService } from '../../services/direct-chat-realtime.service';
import { ChatReactionsComponent } from '../../shared/chat-reactions/chat-reactions.component';
import { DirectChatMessage } from '../model/direct-chat';
import { SessionMessage } from '../model/session-message';
import { CommunityTimelineEntry } from '../../services/community-timeline.service';
import {
  InboxConversation, InboxFilter, InboxKind, InboxMessage,
  inboxKey, matchesInboxSearch, mergeInboxMessages, orderInbox
} from './inbox.model';

@Component({
  selector: 'app-messages-center',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslatePipe, ChatReactionsComponent],
  templateUrl: './messages-center.component.html',
  styleUrls: ['./messages-center.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager
})
export class MessagesCenterComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('previewLog') previewLog?: ElementRef<HTMLElement>;
  @ViewChild('composerTextarea') composerTextarea?: ElementRef<HTMLTextAreaElement>;

  conversations: InboxConversation[] = [];
  selectedKey: string | null = null;
  messages: InboxMessage[] = [];
  filter: InboxFilter = 'all';
  search = '';
  loading = false;
  previewLoading = false;
  previewError = false;
  failedSources: InboxKind[] = [];
  serverSummariesAvailable = true;
  private summaryVersion = 0;
  private readVersion = 0;
  private summaryTimer?: ReturnType<typeof setInterval>;
  realtimeConnected = false;
  everConnected = false;
  draft = '';
  replyingTo: InboxMessage | null = null;
  sending = false;
  deliveryUncertain = false;
  deliveryChecking = false;
  composerAccessLoading = false;
  composerAllowed = false;
  composerError = '';
  composerSuccess = '';
  private composerVersion = 0;
  private readonly drafts = new Map<string, string>();
  private readonly pendingByConversation = new Map<string, {
    key: string; text: string; replyToMessageId: number | null; knownIds: Set<number>; startedAt: number;
  }>();
  private readonly subscriptions = new Subscription();
  private readonly jwt = new JwtHelperService();
  private currentUsername = '';
  private selectionVersion = 0;
  private inboxVersion = 0;
  private scrollRequested = false;
  messageSearchOpen = false;
  messageSearchTerm = '';
  messageSearchResults: InboxMessage[] = [];
  selectedSearchResultId: number | null = null;
  searchResultNotInPreview = false;
  messageSearchLoading = false;
  messageSearchError = false;
  messageSearchSearched = false;
  messageSearchHasMore = false;
  messageSearchPage = 0;
  private messageSearchVersion = 0;
  historicalPreview = false;
  historyLocateLoading = false;
  historyLocateError = false;
  private historyLocateVersion = 0;
  private pendingScrollToMessageId: number | null = null;
  private readonly seenRealtimeIds = new Set<string>();
  private readonly realtimeDuringLoad = new Map<number, InboxMessage>();

  constructor(
    private readonly contacts: CommunityService,
    private readonly groups: CommunityGroupsService,
    private readonly sessions: SessionService,
    private readonly direct: DirectChatService,
    private readonly timeline: CommunityTimelineService,
    private readonly realtime: DirectChatRealtimeService,
    private readonly inboxApi: InboxApiService
  ) {}

  ngOnInit(): void {
    try {
      const token = localStorage.getItem('t');
      this.currentUsername = (token ? this.jwt.decodeToken(token)?.sub : '') || '';
    } catch { this.currentUsername = ''; }

    this.subscriptions.add(this.realtime.messages$.subscribe(message => {
      const from = message.username1.toLowerCase();
      const to = message.username2.toLowerCase();
      const self = this.currentUsername.toLowerCase();
      if (!self || (from !== self && to !== self)) return;
      const peer = from === self ? message.username2 : message.username1;
      this.acceptRealtime(inboxKey('direct', peer), this.fromDirect(message, peer));
    }));
    this.subscriptions.add(this.realtime.communityMessages$.subscribe(message => {
      if (message.kind !== 'CHAT') return;
      this.acceptRealtime(inboxKey('community', message.communityId), this.fromCommunity(message));
    }));
    this.subscriptions.add(this.realtime.sessionMessages$.subscribe(message => {
      this.acceptRealtime(inboxKey('session', message.sessionId), this.fromSession(message));
    }));
    let connectedOnce = false;
    this.subscriptions.add(this.realtime.connected$.subscribe(connected => {
      this.realtimeConnected = connected;
      if (!connected) return;
      this.everConnected = true;
      if (connectedOnce && this.selected && !this.historicalPreview) this.loadHistory(this.selected);
      if (connectedOnce && this.serverSummariesAvailable) this.refreshSummaries();
      connectedOnce = true;
    }));

    this.realtime.connect();
    this.loadInbox();
    this.summaryTimer = setInterval(() => {
      if (this.serverSummariesAvailable && !this.loading) this.refreshSummaries();
    }, 45_000);
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    if (this.summaryTimer) clearInterval(this.summaryTimer);
    // The navbar owns the shared socket lifecycle. Never disconnect it here.
  }

  ngAfterViewChecked(): void {
    const log = this.previewLog?.nativeElement;
    if (!log) return;
    if (this.pendingScrollToMessageId !== null) {
      const target = log.querySelector<HTMLElement>(
        '[data-message-id="' + this.pendingScrollToMessageId + '"]');
      if (target) {
        target.scrollIntoView({ block: 'center', behavior: 'smooth' });
        target.focus({ preventScroll: true });
        this.pendingScrollToMessageId = null;
      }
      return;
    }
    if (this.scrollRequested) {
      log.scrollTop = log.scrollHeight;
      this.scrollRequested = false;
    }
  }

  get selected(): InboxConversation | undefined {
    return this.conversations.find(conversation => conversation.key === this.selectedKey);
  }

  get filteredConversations(): InboxConversation[] {
    return this.conversations.filter(conversation =>
      (this.filter === 'all' || (this.filter === 'recent'
        ? this.unreadCountFor(conversation) > 0 : conversation.kind === this.filter))
      && matchesInboxSearch(conversation, this.search));
  }

  /** One source of truth for both persistent unread badges and the filter. */
  unreadCountFor(conversation: InboxConversation): number {
    return conversation.unreadCount ?? conversation.newThisVisit;
  }

  unreadBadgeText(conversation: InboxConversation): string {
    const count = this.unreadCountFor(conversation);
    return count > 99 ? '99+' : String(count);
  }

  get recentCount(): number {
    return this.conversations.reduce((total, conversation) =>
      total + this.unreadCountFor(conversation), 0);
  }

  get sourceError(): boolean {
    return this.failedSources.length > 0;
  }

  setFilter(filter: InboxFilter): void {
    this.filter = filter;
  }

  loadInbox(): void {
    const request = ++this.inboxVersion;
    this.loading = true;
    this.failedSources = [];

    const failed = (kind: InboxKind) => {
      this.failedSources.push(kind);
    };
    forkJoin({
      friends: this.contacts.friends().pipe(timeout(10000), catchError(() => {
        failed('direct');
        return of([]);
      })),
      communities: this.groups.mine().pipe(timeout(10000), catchError(() => {
        failed('community');
        return of([]);
      })),
      sessions: this.sessions.mine().pipe(timeout(10000), catchError(() => {
        failed('session');
        return of({ created: [], joined: [], waitlisted: [] });
      }))
    }).pipe(finalize(() => {
      if (request === this.inboxVersion) this.loading = false;
    })).subscribe(({ friends, communities, sessions }) => {
      if (request !== this.inboxVersion) return;
      const existing = new Map(this.conversations.map(item => [item.key, item]));
      const entries: InboxConversation[] = [];

      for (const friend of friends) {
        entries.push({
          key: inboxKey('direct', friend.username),
          kind: 'direct',
          id: friend.username,
          title: friend.nickname || friend.fullName || friend.username,
          subtitle: '@' + friend.username,
          newThisVisit: 0
        });
      }

      for (const community of communities) {
        entries.push({
          key: inboxKey('community', community.id),
          kind: 'community',
          id: community.id,
          title: community.name,
          subtitle: community.sport || '',
          newThisVisit: 0
        });
      }

      // 'waitlisted' users have not yet been admitted to session chat.
      const included = new Set<number>();
      for (const session of [...sessions.created, ...sessions.joined]) {
        if (included.has(session.id)) continue;
        included.add(session.id);
        entries.push({
          key: inboxKey('session', session.id),
          kind: 'session',
          id: session.id,
          title: session.sport + ' · ' + session.city,
          subtitle: this.formatDate(session.gameDate),
          newThisVisit: 0
        });
      }

      this.conversations = orderInbox(entries.map(item => ({
        ...item,
        latestText: existing.get(item.key)?.latestText,
        latestAt: existing.get(item.key)?.latestAt,
        newThisVisit: existing.get(item.key)?.newThisVisit || 0,
        unreadCount: existing.get(item.key)?.unreadCount,
        latestMessageId: existing.get(item.key)?.latestMessageId
      })));
      this.refreshSummaries(request);
      // Leave the initial choice to the user: no N+1 history requests at page load.
      if (this.selectedKey && !this.conversations.some(item => item.key === this.selectedKey)) {
        this.selectedKey = null;
        this.messages = [];
        ++this.selectionVersion;
      }
    });
  }

  selectConversation(conversation: InboxConversation): void {
    if (this.sending || this.deliveryChecking) return;
    if (conversation.key === this.selectedKey && !this.previewError) return;
    if (this.selectedKey) this.drafts.set(this.selectedKey, this.draft);
    this.selectedKey = conversation.key;
    ++this.historyLocateVersion;
    this.historicalPreview = false;
    this.historyLocateLoading = false;
    this.historyLocateError = false;
    this.pendingScrollToMessageId = null;
    this.resetMessageSearch();
    this.replyingTo = null;
    this.draft = this.drafts.get(conversation.key) || '';
    this.deliveryUncertain = this.pendingByConversation.has(conversation.key);
    this.composerError = this.deliveryUncertain ? t('chat.sendUnconfirmed') : '';
    this.composerSuccess = '';
    this.composerAllowed = false;
    this.composerAccessLoading = true;
    this.messages = [];
    this.previewError = false;
    this.markReadThisVisit(conversation.key);
    this.loadComposerAccess(conversation);
    this.loadHistory(conversation);
  }

  toggleMessageSearch(): void {
    if (this.messageSearchOpen) {
      this.resetMessageSearch();
    } else {
      this.messageSearchOpen = true;
    }
  }

  private resetMessageSearch(): void {
    ++this.messageSearchVersion;
    this.messageSearchOpen = false;
    this.messageSearchTerm = '';
    this.messageSearchResults = [];
    this.selectedSearchResultId = null;
    this.searchResultNotInPreview = false;
    this.messageSearchLoading = false;
    this.messageSearchError = false;
    this.messageSearchSearched = false;
    this.messageSearchHasMore = false;
    this.messageSearchPage = 0;
  }

  viewMessageSearchResult(result: InboxMessage): void {
    const conversation = this.selected;
    if (!conversation || result.key !== conversation.key
        || !this.messageSearchResults.some(item => item.id === result.id)) return;
    this.selectedSearchResultId = result.id;
    this.historyLocateError = false;
    if (this.messages.some(item => item.id === result.id)) {
      this.searchResultNotInPreview = false;
      this.pendingScrollToMessageId = result.id;
      return;
    }

    // Never append a detached old hit to the newest messages. Fetch an
    // authorized, bounded chronological window around it instead.
    const version = ++this.historyLocateVersion;
    this.searchResultNotInPreview = true;
    this.historyLocateLoading = true;
    const key = conversation.key;
    this.inboxApi.messageContext({ kind: conversation.kind, id: String(conversation.id) }, result.id)
      .pipe(timeout(10_000), finalize(() => {
        if (version === this.historyLocateVersion) this.historyLocateLoading = false;
      })).subscribe({
        next: hits => {
          if (version !== this.historyLocateVersion || this.selectedKey !== key
              || this.selectedSearchResultId !== result.id) return;
          if (!hits.some(hit => hit.id === result.id)) {
            this.historyLocateError = true;
            return;
          }
          // Discard any unfinished recent-history HTTP response without
          // affecting the search results or the user's current draft.
          ++this.selectionVersion;
          this.previewLoading = false;
          this.previewError = false;
          this.historicalPreview = true;
          this.messages = mergeInboxMessages(hits.map(hit => ({
            key, id: hit.id, sender: hit.sender, text: hit.text,
            createdAt: hit.createdAt || '',
            replyToMessageId: hit.replyToMessageId,
            replyToSender: hit.replyToSender, replyToText: hit.replyToText
          })));
          this.searchResultNotInPreview = false;
          this.scrollRequested = false;
          this.pendingScrollToMessageId = result.id;
        },
        error: () => {
          if (version === this.historyLocateVersion && this.selectedKey === key)
            this.historyLocateError = true;
        }
      });
  }

  returnToRecent(): void {
    ++this.historyLocateVersion;
    this.historicalPreview = false;
    this.historyLocateLoading = false;
    this.historyLocateError = false;
    this.pendingScrollToMessageId = null;
    this.selectedSearchResultId = null;
    this.searchResultNotInPreview = false;
    if (this.selected) this.loadHistory(this.selected);
  }

  onMessageSearchTermChange(): void {
    // Invalidate any earlier HTTP result if the user types another query.
    ++this.messageSearchVersion;
    this.messageSearchResults = [];
    this.selectedSearchResultId = null;
    this.searchResultNotInPreview = false;
    ++this.historyLocateVersion;
    this.historyLocateLoading = false;
    this.historyLocateError = false;
    this.messageSearchLoading = false;
    this.messageSearchError = false;
    this.messageSearchSearched = false;
    this.messageSearchHasMore = false;
    this.messageSearchPage = 0;
  }

  submitMessageSearch(page = 0): void {
    const conversation = this.selected;
    const term = this.messageSearchTerm.trim();
    if (!conversation || !this.messageSearchOpen || this.messageSearchLoading
        || term.length < 2 || term.length > 80
        || page < 0 || page > 50 || page > 0 && !this.messageSearchHasMore) return;

    const version = ++this.messageSearchVersion;
    const key = conversation.key;
    this.messageSearchLoading = true;
    this.messageSearchError = false;
    this.messageSearchSearched = true;
    this.inboxApi.searchMessages({ kind: conversation.kind, id: String(conversation.id) }, term, page)
      .pipe(timeout(10_000), finalize(() => {
        if (version === this.messageSearchVersion) this.messageSearchLoading = false;
      }))
      .subscribe({
        next: response => {
          if (version !== this.messageSearchVersion || this.selectedKey !== key
              || !this.messageSearchOpen || this.messageSearchTerm.trim() !== term) return;
          const results = response.results.map(hit => ({
            key, id: hit.id, sender: hit.sender, text: hit.text,
            createdAt: hit.createdAt || '',
            replyToMessageId: hit.replyToMessageId,
            replyToSender: hit.replyToSender, replyToText: hit.replyToText
          }));
          if (page === 0) {
            this.messageSearchResults = results;
          } else {
            // Server sorts hits newest-first; keep that ordering across pages.
            const known = new Set(this.messageSearchResults.map(item => item.id));
            this.messageSearchResults = [...this.messageSearchResults,
              ...results.filter(item => !known.has(item.id))];
          }
          this.messageSearchPage = page;
          this.messageSearchHasMore = response.hasMore && page < 50;
        },
        error: () => {
          if (version !== this.messageSearchVersion || this.selectedKey !== key) return;
          this.messageSearchError = true;
        }
      });
  }

  reloadPreview(): void {
    this.returnToRecent();
  }

  private loadHistory(conversation: InboxConversation): void {
    const version = ++this.selectionVersion;
    this.previewLoading = true;
    this.previewError = false;
    this.realtimeDuringLoad.clear();

    let result: Observable<InboxMessage[]>;
    if (conversation.kind === 'direct') {
      result = this.direct.recentHistory(String(conversation.id)).pipe(
        map(page => page.content.map(message => this.fromDirect(message, String(conversation.id)))));
    } else if (conversation.kind === 'community') {
      result = this.timeline.list(Number(conversation.id), 'CHAT').pipe(
        map(entries => entries.map(entry => this.fromCommunity(entry))));
    } else {
      result = this.sessions.messages(Number(conversation.id)).pipe(
        map(entries => entries.map(entry => this.fromSession(entry))));
    }

    result.pipe(timeout(10000), finalize(() => {
      if (version === this.selectionVersion) this.previewLoading = false;
    })).subscribe({
      next: entries => {
        if (version !== this.selectionVersion || conversation.key !== this.selectedKey) return;
        // Merge live events received after the HTTP request started; never
        // overwrite them with an older response or duplicate their IDs.
        this.messages = mergeInboxMessages([...entries, ...this.realtimeDuringLoad.values()]);
        this.realtimeDuringLoad.clear();
        if (conversation.kind === 'community') {
          this.composerAllowed = true;
          this.composerAccessLoading = false;
        }
        this.confirmFromHistoryIfPresent(conversation.key, this.messages);
        this.updatePreviewFromHistory(conversation.key, this.messages);
        this.markRenderedRead(conversation.key, true);
        this.scrollRequested = true;
      },
      error: () => {
        if (version !== this.selectionVersion || conversation.key !== this.selectedKey) return;
        this.previewError = true;
        this.composerAllowed = false;
        this.composerAccessLoading = false;
      }
    });
  }

  private fromDirect(message: DirectChatMessage, peer: string): InboxMessage {
    return {
      key: inboxKey('direct', peer),
      id: message.id || 0,
      sender: message.username1,
      text: message.text,
      createdAt: message.date || message.dataDisplay || '',
      replyToMessageId: message.replyToMessageId,
      replyToSender: message.replyToSender,
      replyToText: message.replyToText
    };
  }

  private fromCommunity(entry: CommunityTimelineEntry): InboxMessage {
    return { key: inboxKey('community', entry.communityId), id: entry.id,
      sender: entry.username, text: entry.body, createdAt: entry.createdAt,
      replyToMessageId: entry.replyToMessageId, replyToSender: entry.replyToSender,
      replyToText: entry.replyToText };
  }

  private fromSession(entry: SessionMessage): InboxMessage {
    return { key: inboxKey('session', entry.sessionId), id: entry.id,
      sender: entry.senderUsername, text: entry.body, createdAt: entry.createdAt,
      replyToMessageId: entry.replyToMessageId, replyToSender: entry.replyToSender,
      replyToText: entry.replyToText };
  }

  private acceptRealtime(key: string, message: InboxMessage): void {
    if (!this.conversations.some(item => item.key === key) || message.id <= 0) return;
    const eventId = key + ':' + message.id;
    if (this.seenRealtimeIds.has(eventId)) return;
    this.seenRealtimeIds.add(eventId);
    if (this.seenRealtimeIds.size > 1000) this.seenRealtimeIds.clear();

    const isSelected = key === this.selectedKey;
    const isMine = !!this.currentUsername
      && message.sender.toLowerCase() === this.currentUsername.toLowerCase();
    this.conversations = orderInbox(this.conversations.map(conversation =>
      conversation.key === key
        ? { ...conversation, latestText: message.text, latestAt: message.createdAt,
            latestMessageId: message.id,
            unreadCount: conversation.unreadCount === undefined ? undefined :
              conversation.unreadCount + ((!isSelected || this.historicalPreview) && !isMine ? 1 : 0),
            newThisVisit: conversation.newThisVisit + ((!isSelected || this.historicalPreview) && !isMine ? 1 : 0) }
        : conversation));

    if (isSelected) {
      this.confirmFromHistoryIfPresent(key, [message]);
      // The historical window is not the live end of the chat. Never mix
      // fresh socket events into it or acknowledge them as rendered/read.
      if (this.historicalPreview) return;
      this.messages = mergeInboxMessages([...this.messages, message]);
      if (this.previewLoading) this.realtimeDuringLoad.set(message.id, message);
      this.confirmFromHistoryIfPresent(key, [message]);
      if (!this.previewLoading && !this.previewError) this.markRenderedRead(key);
      this.scrollRequested = true;
    }
  }

  private markReadThisVisit(key: string): void {
    this.conversations = this.conversations.map(item =>
      item.key === key ? { ...item, newThisVisit: 0 } : item);
  }

  private updatePreviewFromHistory(key: string, messages: InboxMessage[]): void {
    const last = messages[messages.length - 1];
    if (!last) return;
    this.conversations = orderInbox(this.conversations.map(conversation =>
      conversation.key === key
        ? { ...conversation, latestText: last.text, latestAt: last.createdAt,
            latestMessageId: last.id }
        : conversation));
  }

  private loadComposerAccess(conversation: InboxConversation): void {
    const version = ++this.composerVersion;
    if (conversation.kind === 'community') {
      // Community chat history itself confirms membership; the server
      // rechecks authorization independently for every POST.
      return;
    }
    const access: Observable<boolean> = conversation.kind === 'direct'
      ? this.direct.info(String(conversation.id)).pipe(map(info => !info.chatBlocked))
      : this.sessions.detail(Number(conversation.id)).pipe(map(detail => this.sessionIsWritable(detail)));
    access.pipe(timeout(10000), catchError(() => of(false))).subscribe(allowed => {
      if (version !== this.composerVersion || conversation.key !== this.selectedKey) return;
      this.composerAllowed = allowed;
      this.composerAccessLoading = false;
    });
  }

  private sessionIsWritable(session: SessionDetail): boolean {
    const kickoff = Date.parse(session.gameDate || '');
    return session.joined === true
      && session.status !== 'CANCELLED' && session.status !== 'COMPLETED'
      && session.problemType !== 'NOT_OCCURRED'
      && Number.isFinite(kickoff) && Date.now() < kickoff + 2 * 60 * 60 * 1000;
  }

  canSendMessage(): boolean {
    return Boolean(this.selected && this.composerAllowed && !this.composerAccessLoading
      && !this.previewLoading && !this.previewError && !this.sending && !this.deliveryUncertain
      && !this.deliveryChecking && this.draft.trim().length > 0
      && this.draft.trim().length <= 2000);
  }

  replyToMessage(message: InboxMessage): void {
    if (message.id <= 0 || message.key !== this.selectedKey
        || !this.composerAllowed || this.sending || this.deliveryUncertain) return;
    this.replyingTo = message;
    this.composerTextarea?.nativeElement.focus({ preventScroll: true });
  }

  cancelReply(): void {
    if (!this.sending && !this.deliveryUncertain) this.replyingTo = null;
  }

  onComposerEnter(event: Event): void {
    const keyboard = event as KeyboardEvent;
    if (keyboard.shiftKey || keyboard.isComposing || keyboard.keyCode === 229) return;
    keyboard.preventDefault();
    this.sendMessage();
  }

  private recentHistory(conversation: InboxConversation): Observable<InboxMessage[]> {
    if (conversation.kind === 'direct') return this.direct.recentHistory(String(conversation.id))
      .pipe(map(page => page.content.map(item => this.fromDirect(item, String(conversation.id)))));
    if (conversation.kind === 'community') return this.timeline.list(Number(conversation.id), 'CHAT')
      .pipe(map(entries => entries.map(item => this.fromCommunity(item))));
    return this.sessions.messages(Number(conversation.id))
      .pipe(map(entries => entries.map(item => this.fromSession(item))));
  }

  sendMessage(): void {
    const conversation = this.selected;
    if (!conversation || !this.canSendMessage()) return;
    const key = conversation.key;
    const text = this.draft.trim();
    const replyId = this.replyingTo?.key === key ? this.replyingTo.id : null;
    const pending = { key, text, replyToMessageId: replyId,
      knownIds: new Set(this.messages.map(item => item.id)),
      startedAt: Date.now() };

    let send: Observable<InboxMessage>;
    if (conversation.kind === 'direct') {
      const request = replyId
        ? this.direct.send(String(conversation.id), text, replyId)
        : this.direct.send(String(conversation.id), text);
      send = request.pipe(map(message => this.fromDirect(message, String(conversation.id))));
    } else if (conversation.kind === 'community') {
      const request = replyId
        ? this.timeline.send(Number(conversation.id), 'CHAT', text, replyId)
        : this.timeline.send(Number(conversation.id), 'CHAT', text);
      send = request.pipe(map(message => this.fromCommunity(message)));
    } else {
      const request = replyId
        ? this.sessions.postMessage(Number(conversation.id), text, replyId)
        : this.sessions.postMessage(Number(conversation.id), text);
      send = request.pipe(map(message => this.fromSession(message)));
    }

    this.sending = true;
    this.composerError = '';
    this.composerSuccess = '';
    // A disabled textarea loses focus while the POST is pending. Keep it
    // enabled/read-only and restore focus immediately after button submits.
    // Never steal focus later when the HTTP response arrives.
    this.composerTextarea?.nativeElement.focus({ preventScroll: true });
    // Unlike HTTP GETs, ambiguous POSTs are NEVER automatically retried.
    send.pipe(timeout(10000), finalize(() => { this.sending = false; })).subscribe({
      next: message => {
        if (key !== this.selectedKey) return;
        this.acceptRealtime(key, message);
        if (this.historicalPreview) this.returnToRecent();
        this.draft = '';
        this.replyingTo = null;
        this.drafts.delete(key);
        this.pendingByConversation.delete(key);
        this.deliveryUncertain = false;
      },
      error: error => {
        if (key !== this.selectedKey) return;
        if (this.isUncertainError(error)) {
          this.pendingByConversation.set(key, pending);
          this.deliveryUncertain = true;
          this.composerError = t('chat.sendUncertain');
          this.verifyDelivery();
        } else {
          this.composerError = t('feedback.chat.sendError');
          // Permission may have changed since the conversation was opened.
          if (error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403)) {
            this.composerAllowed = false;
          }
        }
      }
    });
  }

  private isUncertainError(error: unknown): boolean {
    return error instanceof TimeoutError
      || !(error instanceof HttpErrorResponse)
      || error.status === 0 || error.status === 408 || error.status === 429 || error.status >= 500;
  }

  private matchesPending(message: InboxMessage, pending: {
    key: string; text: string; replyToMessageId: number | null; knownIds: Set<number>; startedAt: number;
  }): boolean {
    if (message.key !== pending.key || pending.knownIds.has(message.id) || message.text !== pending.text
      || !this.currentUsername || message.sender.toLowerCase() !== this.currentUsername.toLowerCase()) return false;
    const sentAt = Date.parse(message.createdAt);
    return Number.isFinite(sentAt) && sentAt >= pending.startedAt - 60_000
      && (message.replyToMessageId ?? null) === pending.replyToMessageId;
  }

  private confirmFromHistoryIfPresent(key: string, messages: InboxMessage[]): void {
    const pending = this.pendingByConversation.get(key);
    if (pending && messages.some(message => this.matchesPending(message, pending))) {
      this.pendingByConversation.delete(key);
      if (this.selectedKey === key) {
        this.deliveryUncertain = false;
        this.draft = '';
        this.replyingTo = null;
        this.drafts.delete(key);
        this.composerError = '';
        this.composerSuccess = t('chat.sendConfirmed');
      }
    }
  }

  verifyDelivery(): void {
    const conversation = this.selected;
    const pending = conversation && this.pendingByConversation.get(conversation.key);
    if (!conversation || !pending || !this.deliveryUncertain || this.deliveryChecking) return;
    if (this.messages.some(item => this.matchesPending(item, pending))) {
      this.confirmFromHistoryIfPresent(conversation.key, this.messages);
      return;
    }
    this.deliveryChecking = true;
    this.recentHistory(conversation).pipe(timeout(10000), finalize(() => {
      this.deliveryChecking = false;
    })).subscribe({
      next: entries => {
        if (conversation.key !== this.selectedKey) return;
        const delivered = entries.find(item => this.matchesPending(item, pending));
        if (delivered) {
          this.messages = mergeInboxMessages([...this.messages, delivered]);
          this.updatePreviewFromHistory(conversation.key, this.messages);
          this.confirmFromHistoryIfPresent(conversation.key, [delivered]);
          this.scrollRequested = true;
        } else {
          this.composerError = t('chat.sendUnconfirmed');
        }
      },
      error: () => {
        if (conversation.key === this.selectedKey) this.composerError = t('chat.verifyUnavailable');
      }
    });
  }

  resumeAfterUncertainSend(): void {
    if (this.sending || this.deliveryChecking || !this.selectedKey || !this.deliveryUncertain) return;
    this.pendingByConversation.delete(this.selectedKey);
    this.deliveryUncertain = false;
    this.composerError = t('chat.sendRetryWarning');
    // The draft remains intact. Any further POST requires a deliberate action.
  }

  /** Read markers live on the server, not in localStorage or notification badges. */
  refreshSummaries(inboxVersion = this.inboxVersion): void {
    if (!this.serverSummariesAvailable || this.conversations.length === 0) return;
    const requestVersion = ++this.summaryVersion;
    const batches = [];
    for (let offset = 0; offset < this.conversations.length; offset += 150) {
      const chunk = this.conversations.slice(offset, offset + 150);
      batches.push(this.inboxApi.summaries(chunk.map(item => ({
        kind: item.kind, id: String(item.id)
      }))).pipe(timeout(15_000)));
    }
    forkJoin(batches).subscribe({
      next: batchesResult => {
        if (inboxVersion !== this.inboxVersion || requestVersion !== this.summaryVersion) return;
        const summaries = new Map<string, InboxSummary>();
        for (const batch of batchesResult) {
          for (const snapshot of batch) summaries.set(inboxKey(snapshot.kind, snapshot.id), snapshot);
        }
        this.conversations = orderInbox(this.conversations.map(item => {
          const snapshot = summaries.get(item.key);
          if (!snapshot) return item;
          // Do not regress after a newer WebSocket message reached this tab
          // while the HTTP snapshot was still in transit.
          const socketNewer = !!item.latestAt && (!snapshot.latestAt
            || Date.parse(item.latestAt) > Date.parse(snapshot.latestAt));
          if (socketNewer) {
            return { ...item, unreadCount: Math.max(item.unreadCount ?? 0, snapshot.unreadCount) };
          }
          return { ...item,
            latestText: snapshot.latestText ?? undefined,
            latestAt: snapshot.latestAt ?? undefined,
            latestMessageId: snapshot.latestMessageId,
            unreadCount: snapshot.unreadCount,
            newThisVisit: 0
          };
        }));
      },
      error: () => {
        if (requestVersion !== this.summaryVersion) return;
        // The earlier frontend still works with its local, visit-scoped
        // counters if this new endpoint is temporarily unavailable.
        this.serverSummariesAvailable = false;
      }
    });
  }

  private markRenderedRead(key: string, fromLoadedHistory = false): void {
    if (!this.serverSummariesAvailable || key !== this.selectedKey || this.historicalPreview
        || (this.previewLoading && !fromLoadedHistory) || this.previewError || this.messages.length === 0) return;
    const lastSeen = Math.max(...this.messages.map(message => message.id));
    if (!Number.isSafeInteger(lastSeen) || lastSeen <= 0) return;
    const conversation = this.selected;
    if (!conversation) return;
    const readVersion = ++this.readVersion;
    this.inboxApi.markRead({ kind: conversation.kind, id: String(conversation.id) }, lastSeen)
      .pipe(timeout(10_000)).subscribe({
        next: snapshot => {
          if (readVersion !== this.readVersion || this.selectedKey !== key) return;
          ++this.summaryVersion; // invalidate snapshots taken before this read acknowledgement
          this.conversations = this.conversations.map(item => item.key === key
            ? { ...item, unreadCount: snapshot.unreadCount, newThisVisit: 0 }
            : item);
        },
        error: () => {
          // Never pretend that a failed read receipt has synchronized.
          // A later refresh can reconcile it with the server.
        }
      });
  }

  conversationLink(conversation: InboxConversation): (string | number)[] {
    if (conversation.kind === 'direct') return ['/menu/friendList/chat', String(conversation.id)];
    if (conversation.kind === 'community') return ['/menu/communities', Number(conversation.id)];
    return ['/menu/events', Number(conversation.id)];
  }

  conversationQuery(conversation: InboxConversation): Record<string, string> {
    if (conversation.kind === 'community') return { tab: 'chat' };
    if (conversation.kind === 'session') return { chat: '1' };
    return {};
  }

  isMine(message: InboxMessage): boolean {
    return !!this.currentUsername
      && message.sender.toLowerCase() === this.currentUsername.toLowerCase();
  }

  kindLabel(kind: InboxKind): string {
    return kind === 'direct' ? 'inbox.private' : kind === 'community' ? 'inbox.community' : 'inbox.session';
  }

  formatDate(value: string): string {
    const millis = Date.parse(value || '');
    return Number.isFinite(millis)
      ? new Intl.DateTimeFormat('pt-PT', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(millis))
      : '';
  }
}
