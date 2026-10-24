import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, OnDestroy, OnInit, AfterViewChecked, ViewChild, ChangeDetectionStrategy, Optional } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
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
import { ChatTypingTracker } from '../../services/chat-typing-tracker';
import { chatContinuesGroup, chatDaySeparator } from '../../shared/chat-thread-presentation';
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
  /** Only a confirmed response about the currently selected private peer applies. */
  private peerReadCursor: number | null = null;
  private peerReceiptVersion = 0;
  private readonly ownReadSyncVersions = new Map<string, number>();
  private peerReceiptCheckedAt = 0;
  /** Token active when this inbox mounted; a different login must not inherit receipts. */
  private receiptSessionToken: string | null = null;
  private summaryTimer?: ReturnType<typeof setInterval>;
  private receiptTimer?: ReturnType<typeof setInterval>;
  /** Only a foreground inbox can acknowledge messages as actually viewed. */
  private isPageActive(): boolean {
    return document.visibilityState === 'visible' && document.hasFocus();
  }
  private readonly onPageActive = (): void => {
    if (!this.isPageActive()) return;
    if (this.selectedKey) this.markRenderedRead(this.selectedKey);
    this.refreshPeerReadReceipt(true);
    // A laptop may have resumed without a socket reconnect notification.
    // Only GET server history; never retry an ambiguous message POST.
    this.reconcilePendingDeliveries(false);
  };
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
  // Send and delivery checks belong to conversations, not the entire inbox.
  // A delayed response must not lock or mutate a different selected thread.
  private readonly sendingKeys = new Set<string>();
  /** Match an AFTER_COMMIT socket event that beats the POST timeout/error. */
  private readonly inFlightByConversation = new Map<string, {
    key: string; text: string; replyToMessageId: number | null; knownIds: Set<number>; startedAt: number;
  }>();
  private readonly confirmedWhileSending = new Map<string, InboxMessage>();
  private readonly verifyingKeys = new Set<string>();
  private lastPendingRecheckAt = 0;
  private readonly sendErrorsByConversation = new Map<string, string>();
  private readonly subscriptions = new Subscription();
  private readonly jwt = new JwtHelperService();
  private currentUsername = '';
  private selectionVersion = 0;
  private inboxVersion = 0;
  private scrollRequested = false;
  newMessagesPending = 0;
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
  private pendingDeepLinkKey: string | null = null;
  private observedDeepLinkKey: string | null = null;
  private readonly sessionKickoffs = new Map<number, number>();
  readonly typing: ChatTypingTracker;

  constructor(
    private readonly contacts: CommunityService,
    private readonly groups: CommunityGroupsService,
    private readonly sessions: SessionService,
    private readonly direct: DirectChatService,
    private readonly timeline: CommunityTimelineService,
    private readonly realtime: DirectChatRealtimeService,
    private readonly inboxApi: InboxApiService,
    @Optional() private readonly route: ActivatedRoute | null = null
  ) {
    this.typing = new ChatTypingTracker(realtime);
  }

  ngOnInit(): void {
    // Angular reuses the component when only the query changes.
    if (this.route?.queryParamMap) {
      this.subscriptions.add(this.route.queryParamMap.subscribe(params =>
        this.queueDeepLink(params.get('kind'), params.get('id'))));
    } else {
      this.queueDeepLink(
        this.route?.snapshot?.queryParamMap?.get('kind') ?? null,
        this.route?.snapshot?.queryParamMap?.get('id') ?? null);
    }
    try {
      const token = localStorage.getItem('t');
      this.receiptSessionToken = token;
      this.currentUsername = (token ? this.jwt.decodeToken(token)?.sub : '') || '';
    } catch { this.currentUsername = ''; this.receiptSessionToken = null; }

    this.subscriptions.add(this.realtime.messages$.subscribe(message => {
      const from = message.username1.toLowerCase();
      const to = message.username2.toLowerCase();
      const self = this.currentUsername.toLowerCase();
      if (!self || (from !== self && to !== self)) return;
      const peer = from === self ? message.username2 : message.username1;
      this.acceptRealtime(inboxKey('direct', peer), this.fromDirect(message, peer));
    }));
    // These events are pushed only AFTER_COMMIT by the server and address
    // the original sender. Unknown peers/sessions must never affect the UI.
    this.subscriptions.add(this.realtime.readReceipts$.subscribe(receipt => {
      this.acceptPersistedPeerReadReceipt(receipt);
    }));
    this.subscriptions.add(this.realtime.ownReads$.subscribe(read => {
      this.refreshOwnPersistedRead(read);
    }));
    this.subscriptions.add(this.realtime.communityMessages$.subscribe(message => {
      if (message.kind !== 'CHAT') return;
      this.acceptRealtime(inboxKey('community', message.communityId), this.fromCommunity(message));
    }));
    this.subscriptions.add(this.realtime.sessionMessages$.subscribe(message => {
      this.acceptRealtime(inboxKey('session', message.sessionId), this.fromSession(message));
    }));
    let connectedOnce = false;
    let disconnectedAfterAuth = false;
    this.subscriptions.add(this.realtime.connected$.subscribe(connected => {
      this.realtimeConnected = connected;
      if (!connected) {
        if (connectedOnce) disconnectedAfterAuth = true;
        return;
      }
      this.everConnected = true;
      // Initial AUTH is followed by loadInbox below. After a real outage,
      // refresh membership + summaries BEFORE replacing the selected history.
      // A second AUTH notification without a disconnect is not a new outage.
      if (connectedOnce && disconnectedAfterAuth && this.isReceiptSessionCurrent()) {
        this.loadInbox(true);
        this.refreshPeerReadReceipt(true);
      }
      connectedOnce = true;
      disconnectedAfterAuth = false;
    }));

    this.realtime.connect();
    this.loadInbox();
    window.addEventListener('focus', this.onPageActive);
    document.addEventListener('visibilitychange', this.onPageActive);
    this.summaryTimer = setInterval(() => {
      if (this.loading || !this.isReceiptSessionCurrent()) return;
      // Retry a failed membership lookup only after the normal 45s interval.
      // Otherwise keep the existing cheap, batched summary refresh.
      if (this.failedSources.length) this.loadInbox(true);
      else if (this.serverSummariesAvailable) this.refreshSummaries();
    }, 45_000);
    // Only an actively viewed private chat polls its receipt, at most once
    // every 15 seconds. Background tabs do not add API traffic.
    this.receiptTimer = setInterval(() => this.refreshPeerReadReceipt(), 15_000);
  }

  ngOnDestroy(): void {
    this.typing.destroy();
    ++this.peerReceiptVersion;
    this.subscriptions.unsubscribe();
    window.removeEventListener('focus', this.onPageActive);
    document.removeEventListener('visibilitychange', this.onPageActive);
    if (this.summaryTimer) clearInterval(this.summaryTimer);
    if (this.receiptTimer) clearInterval(this.receiptTimer);
    // The navbar owns the shared socket lifecycle. Never disconnect it here.
  }

  dayLabelAt(index: number): string {
    const current = this.messages[index];
    return current ? chatDaySeparator(current.createdAt,
      index > 0 ? this.messages[index - 1].createdAt : null) : '';
  }

  continuesGroupAt(index: number): boolean {
    if (index <= 0) return false;
    const current = this.messages[index], previous = this.messages[index - 1];
    return chatContinuesGroup(current.sender, current.createdAt,
      previous.sender, previous.createdAt);
  }

  private isNearPreviewBottom(): boolean {
    const log = this.previewLog?.nativeElement;
    return !log || log.scrollHeight - log.scrollTop - log.clientHeight < 120;
  }

  onPreviewLogScroll(): void {
    if (this.isNearPreviewBottom()) {
      this.newMessagesPending = 0;
      if (this.selectedKey) this.markRenderedRead(this.selectedKey);
    }
  }

  jumpToLatestMessages(): void {
    if (this.historicalPreview || !this.previewLog?.nativeElement) return;
    const log = this.previewLog.nativeElement;
    log.scrollTop = log.scrollHeight;
    this.newMessagesPending = 0;
    if (this.selectedKey) this.markRenderedRead(this.selectedKey);
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
      this.newMessagesPending = 0;
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

  loadInbox(recoverAfterReconnect = false): void {
    // Support snapshot-only navigation contexts as well as live route streams.
    if (this.observedDeepLinkKey === null && this.route?.snapshot?.queryParamMap) {
      this.queueDeepLink(this.route.snapshot.queryParamMap.get('kind'),
        this.route.snapshot.queryParamMap.get('id'));
    }
    const request = ++this.inboxVersion;
    this.loading = true;
    this.failedSources = [];
    const failedKinds = new Set<InboxKind>();
    // Outdated requests must never corrupt another request's error state.
    const failed = (kind: InboxKind) => {
      failedKinds.add(kind);
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
      if (request !== this.inboxVersion || (recoverAfterReconnect && !this.isReceiptSessionCurrent())) return;
      this.failedSources = [...failedKinds];
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
      this.sessionKickoffs.clear();
      const included = new Set<number>();
      for (const session of [...sessions.created, ...sessions.joined]) {
        // The only available session conversations are games yet to happen.
        const kickoff = Date.parse(session.gameDate || '');
        if (!Number.isFinite(kickoff) || kickoff <= Date.now()
            || session.status === 'CANCELLED' || session.status === 'COMPLETED'
            || session.status === 'NOT_OCCURRED' || included.has(session.id)) continue;
        included.add(session.id);
        this.sessionKickoffs.set(session.id, kickoff);
        entries.push({
          key: inboxKey('session', session.id),
          kind: 'session',
          id: session.id,
          title: session.sport + ' · ' + session.city,
          subtitle: this.formatDate(session.gameDate),
          newThisVisit: 0
        });
      }

      // A failed membership source is not proof that membership was revoked:
      // keep its already-authorized rows while the retry is pending. A
      // successful source may remove genuinely revoked/deleted conversations.
      for (const previous of existing.values()) {
        if (failedKinds.has(previous.kind) && !entries.some(item => item.key === previous.key)) {
          entries.push(previous);
        }
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
      // Consume a link only once; a refresh must not override manual selection.
      this.openPendingDeepLink();
      // Leave the initial choice to the user: no N+1 history requests at page load.
      if (this.selectedKey && !this.conversations.some(item => item.key === this.selectedKey)) {
        this.selectedKey = null;
        this.messages = [];
        ++this.selectionVersion;
      }
      // A delayed history refresh must never run for a removed conversation,
      // a failed membership source, or a detached historical search window.
      const active = this.selected;
      if (recoverAfterReconnect && active && !this.historicalPreview
          && !failedKinds.has(active.kind)) this.loadHistory(active);
      // Check uncertain POSTs for ALL still-authorized conversations. The
      // selected recent history above already performs its own confirmation.
      if (recoverAfterReconnect) this.reconcilePendingDeliveries(
        true, active && !this.historicalPreview && !failedKinds.has(active.kind)
          ? active.key : null, failedKinds
      );
    });
  }

  private queueDeepLink(kind: string | null, id: string | null): void {
    const supported = kind === 'direct' || kind === 'community' || kind === 'session';
    const value = id?.trim() || '';
    const numericId = /^[1-9][0-9]*$/.test(value) && Number.isSafeInteger(Number(value));
    const next = supported && value && value.length <= 128
      && (kind === 'direct' || numericId) ? inboxKey(kind, value) : null;
    if (next === this.observedDeepLinkKey) return;
    this.observedDeepLinkKey = next;
    this.pendingDeepLinkKey = next;
    this.openPendingDeepLink();
  }

  private openPendingDeepLink(): void {
    if (!this.pendingDeepLinkKey) return;
    const target = this.conversations.find(item => item.key === this.pendingDeepLinkKey);
    if (!target) return; // Never add a forged or expired conversation.
    this.pendingDeepLinkKey = null;
    if (target.key !== this.selectedKey) this.selectConversation(target);
  }

  isSelectedSessionOpen(): boolean {
    const target = this.selected;
    return !target || target.kind !== 'session'
      || Date.now() < (this.sessionKickoffs.get(Number(target.id)) ?? 0);
  }

  selectConversation(conversation: InboxConversation): void {
    if (conversation.key === this.selectedKey && !this.previewError) return;
    if (this.selectedKey) this.drafts.set(this.selectedKey, this.draft);
    this.typing.stop();
    this.selectedKey = conversation.key;
    ++this.peerReceiptVersion;
    this.peerReadCursor = null;
    this.peerReceiptCheckedAt = 0;
    this.newMessagesPending = 0;
    ++this.historyLocateVersion;
    this.historicalPreview = false;
    this.historyLocateLoading = false;
    this.historyLocateError = false;
    this.pendingScrollToMessageId = null;
    this.resetMessageSearch();
    this.replyingTo = null;
    this.draft = this.drafts.get(conversation.key) || '';
    this.deliveryUncertain = this.pendingByConversation.has(conversation.key);
    this.sending = this.sendingKeys.has(conversation.key);
    this.deliveryChecking = this.verifyingKeys.has(conversation.key);
    this.composerError = this.deliveryUncertain
      ? t('chat.sendUnconfirmed') : this.sendErrorsByConversation.get(conversation.key) || '';
    this.composerSuccess = '';
    this.composerAllowed = false;
    this.composerAccessLoading = true;
    this.messages = [];
    this.previewError = false;
    this.markReadThisVisit(conversation.key);
    this.loadComposerAccess(conversation);
    this.loadHistory(conversation);
    this.refreshPeerReadReceipt(true);
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
      const target = this.previewLog?.nativeElement?.querySelector<HTMLElement>(
        '[data-message-id="' + result.id + '"]');
      if (target) {
        target.scrollIntoView({ block: 'center', behavior: 'smooth' });
        target.focus({ preventScroll: true });
      } else {
        this.pendingScrollToMessageId = result.id;
      }
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
          this.newMessagesPending = 0;
          if (conversation.kind === 'community') {
            this.composerAllowed = true;
            this.composerAccessLoading = false;
          }
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
    this.newMessagesPending = 0;
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
    this.pendingScrollToMessageId = null;
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
        // Keep a user's scroll position when refreshing an already opened history.
        const follow = this.messages.length === 0 || this.isNearPreviewBottom();
        // Merge live events received after the HTTP request started; never
        // overwrite them with an older response or duplicate their IDs.
        const before = new Set(this.messages.map(item => item.id));
        const latestServerId = entries.reduce((max, item) => Math.max(max, item.id), 0);
        // When the user is reading above the bottom, never discard their
        // earlier loaded window. When following the tail, retain only local
        // messages newer than the HTTP snapshot to avoid losing socket events.
        const preserved = follow
          ? this.messages.filter(item => item.id > latestServerId)
          : this.messages;
        this.messages = mergeInboxMessages([
          ...preserved, ...entries, ...this.realtimeDuringLoad.values()
        ]);
        if (!follow && before.size > 0 && !this.historicalPreview) {
          this.newMessagesPending += this.messages.filter(item =>
            !before.has(item.id) && item.sender.toLowerCase() !== this.currentUsername.toLowerCase()).length;
        }
        if (follow) this.newMessagesPending = 0;
        this.realtimeDuringLoad.clear();
        if (conversation.kind === 'community') {
          this.composerAllowed = true;
          this.composerAccessLoading = false;
        }
        this.confirmFromHistoryIfPresent(conversation.key, this.messages);
        this.updatePreviewFromHistory(conversation.key, this.messages);
        if (follow) this.markRenderedRead(conversation.key, true);
        this.scrollRequested = follow;
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

    const sending = this.inFlightByConversation.get(key);
    if (sending && this.matchesPending(message, sending)) {
      // The server committed the POST, but its HTTP response could still
      // timeout. Remember this exact server message until the POST settles.
      this.confirmedWhileSending.set(key, message);
    }
    // A delivery already marked uncertain is confirmed even if the
    // recipient is NOT the conversation currently shown on this device.
    this.confirmFromHistoryIfPresent(key, [message]);

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
      // The historical window is not the live end of the chat. Never mix
      // fresh socket events into it or acknowledge them as rendered/read.
      if (this.historicalPreview) return;
      const follow = isMine || this.isNearPreviewBottom();
      if (!follow) this.newMessagesPending++;
      else this.newMessagesPending = 0;
      this.messages = mergeInboxMessages([...this.messages, message]);
      if (this.previewLoading) this.realtimeDuringLoad.set(message.id, message);
      if (!this.previewLoading && !this.previewError && follow) this.markRenderedRead(key);
      this.scrollRequested = follow;
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
    return (session.joined === true || Boolean(this.currentUsername
        && session.creatorUsername?.toLowerCase() === this.currentUsername.toLowerCase()))
      && session.status !== 'CANCELLED' && session.status !== 'COMPLETED'
      && session.problemType !== 'NOT_OCCURRED'
      && Number.isFinite(kickoff) && Date.now() < kickoff;
  }

  canSendMessage(): boolean {
    return Boolean(this.selected && this.isSelectedSessionOpen()
      && this.composerAllowed && !this.composerAccessLoading
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

  onTypingInput(): void {
    const conversation = this.selected;
    if (!conversation) return;
    this.typing.input(conversation.kind, conversation.id, this.draft, this.canSendMessage());
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
    this.typing.stop();
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

    this.sendingKeys.add(key);
    this.inFlightByConversation.set(key, pending);
    this.confirmedWhileSending.delete(key);
    this.sending = true;
    this.sendErrorsByConversation.delete(key);
    this.composerError = '';
    this.composerSuccess = '';
    // A disabled textarea loses focus while the POST is pending. Keep it
    // enabled/read-only and restore focus immediately after button submits.
    // Never steal focus later when the HTTP response arrives.
    this.composerTextarea?.nativeElement.focus({ preventScroll: true });
    // Unlike HTTP GETs, ambiguous POSTs are NEVER automatically retried.
    send.pipe(timeout(10000), finalize(() => {
      this.sendingKeys.delete(key);
      this.inFlightByConversation.delete(key);
      this.confirmedWhileSending.delete(key);
      if (this.selectedKey === key) this.sending = false;
    })).subscribe({
      next: message => {
        // The server's confirmed response belongs to the original thread,
        // even if the user navigated elsewhere while the POST was pending.
        this.acceptRealtime(key, message);
        this.drafts.delete(key);
        this.pendingByConversation.delete(key);
        this.sendErrorsByConversation.delete(key);
        if (key !== this.selectedKey) return;
        if (this.historicalPreview) this.returnToRecent();
        this.draft = '';
        this.replyingTo = null;
        this.deliveryUncertain = false;
        this.composerError = '';
      },
      error: error => {
        if (this.isUncertainError(error)) {
          // WebSocket can prove AFTER_COMMIT delivery before HTTP times out.
          // Resolve that race before marking a send uncertain or issuing
          // another GET. Never retry the original POST automatically.
          this.pendingByConversation.set(key, pending);
          const confirmed = this.confirmedWhileSending.get(key)
            || (key === this.selectedKey
              ? this.messages.find(item => this.matchesPending(item, pending))
              : undefined);
          if (confirmed && this.matchesPending(confirmed, pending)) {
            this.confirmFromHistoryIfPresent(key, [confirmed]);
            return;
          }
          if (key === this.selectedKey) {
            this.deliveryUncertain = true;
            this.composerError = t('chat.sendUncertain');
            this.verifyDelivery();
          }
        } else {
          const errorText = t('feedback.chat.sendError');
          this.sendErrorsByConversation.set(key, errorText);
          if (key === this.selectedKey) {
            this.composerError = errorText;
            // Permissions may have changed while this POST was pending.
            if (error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403)) {
              this.composerAllowed = false;
            }
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
      // A server-confirmed message clears its original draft even when
      // verification finishes after navigation to a different conversation.
      // Never clear the currently edited draft of another thread.
      this.drafts.delete(key);
      this.sendErrorsByConversation.delete(key);
      if (this.selectedKey === key) {
        this.deliveryUncertain = false;
        this.draft = '';
        this.replyingTo = null;
        this.composerError = '';
        this.composerSuccess = t('chat.sendConfirmed');
      }
    }
  }

  /** Read-only reconciliation for uncertain sends on reconnect or foreground. */
  private reconcilePendingDeliveries(
    force: boolean,
    skipKey: string | null = null,
    failedKinds: ReadonlySet<InboxKind> = new Set<InboxKind>()
  ): void {
    if (!this.pendingByConversation.size || !this.isReceiptSessionCurrent()) return;
    const now = Date.now();
    // Focus/visibility events can fire in bursts. Reconnect itself bypasses
    // the interval; per-thread in-flight requests cannot overlap.
    if (!force && now - this.lastPendingRecheckAt < 15_000) return;
    this.lastPendingRecheckAt = now;
    for (const [key, pending] of this.pendingByConversation) {
      if (key === skipKey || this.verifyingKeys.has(key)) continue;
      const conversation = this.conversations.find(item => item.key === key);
      if (!conversation || failedKinds.has(conversation.kind)) continue;
      this.checkPendingDelivery(conversation, pending);
    }
  }

  private checkPendingDelivery(
    conversation: InboxConversation,
    pending: { key: string; text: string; replyToMessageId: number | null;
      knownIds: Set<number>; startedAt: number }
  ): void {
    const key = conversation.key;
    if (this.verifyingKeys.has(key)) return;
    if (this.selectedKey === key && this.messages.some(item => this.matchesPending(item, pending))) {
      this.confirmFromHistoryIfPresent(key, this.messages);
      return;
    }
    this.verifyingKeys.add(key);
    if (this.selectedKey === key) this.deliveryChecking = true;
    this.recentHistory(conversation).pipe(timeout(10000), finalize(() => {
      this.verifyingKeys.delete(key);
      if (this.selectedKey === key) this.deliveryChecking = false;
    })).subscribe({
      next: entries => {
        // An account change, revoked conversation, cancelled retry, or
        // newer confirmation makes this old GET irrelevant.
        if (!this.isReceiptSessionCurrent()
            || !this.conversations.some(item => item.key === key)
            || this.pendingByConversation.get(key) !== pending) return;
        const delivered = entries.find(item => this.matchesPending(item, pending));
        if (delivered) {
          this.acceptRealtime(key, delivered);
          if (key === this.selectedKey && !this.historicalPreview) {
            this.messages = mergeInboxMessages([...this.messages, delivered]);
            this.updatePreviewFromHistory(key, this.messages);
            this.scrollRequested = true;
          }
          this.confirmFromHistoryIfPresent(key, [delivered]);
        } else if (key === this.selectedKey) {
          // A limited history window is NOT proof the original POST failed.
          this.composerError = t('chat.sendUnconfirmed');
        }
      },
      error: () => {
        // A failed GET is never interpreted as evidence to send again.
        if (key === this.selectedKey && this.isReceiptSessionCurrent()
            && this.pendingByConversation.get(key) === pending) {
          this.composerError = t('chat.verifyUnavailable');
        }
      }
    });
  }

  verifyDelivery(): void {
    const conversation = this.selected;
    const pending = conversation && this.pendingByConversation.get(conversation.key);
    if (!conversation || !pending || !this.deliveryUncertain
        || this.verifyingKeys.has(conversation.key)) return;
    this.checkPendingDelivery(conversation, pending);
  }

  resumeAfterUncertainSend(): void {
    if (this.sendingKeys.has(this.selectedKey || '')
        || this.verifyingKeys.has(this.selectedKey || '')
        || !this.selectedKey || !this.deliveryUncertain) return;
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
    // A background/unfocused browser must not make a message look read.
    if (!this.isPageActive() || !this.serverSummariesAvailable || key !== this.selectedKey || this.historicalPreview
        || (this.previewLoading && !fromLoadedHistory) || this.previewError || this.messages.length === 0) return;
    if (!fromLoadedHistory && !this.isNearPreviewBottom()) return;
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

  /**
   * For private chats only, a read check is shown solely after the recipient's
   * authorized persisted cursor includes the message's positive server ID.
   */
  private isReceiptSessionCurrent(): boolean {
    // Different logins in tabs on the same origin share localStorage. Fail
    // closed until Angular creates a new inbox for the active account.
    try {
      return !!this.receiptSessionToken && localStorage.getItem('t') === this.receiptSessionToken;
    } catch { return false; }
  }

  isDirectMessageRead(message: InboxMessage): boolean {
    return this.isReceiptSessionCurrent() && this.selected?.kind === 'direct'
      && message.key === this.selectedKey && this.isMine(message)
      && Number.isSafeInteger(message.id) && message.id > 0
      && this.peerReadCursor !== null && this.peerReadCursor >= message.id;
  }

  /**
   * A different browser of THIS identity read a conversation. Never set
   * unread=0 from an event alone: a newer message might have arrived while
   * the read transaction committed. Fetch the authoritative count for just
   * that one conversation; ordinary 45-second summaries recover socket loss.
   */
  private refreshOwnPersistedRead(
    read: { kind: InboxKind; conversationId: string; lastReadMessageId: number } | null
  ): void {
    if (!this.isReceiptSessionCurrent() || !read
        || !['direct', 'community', 'session'].includes(read.kind)
        || typeof read.conversationId !== 'string'
        || read.conversationId.length === 0 || read.conversationId.length > 128
        || !Number.isSafeInteger(read.lastReadMessageId) || read.lastReadMessageId <= 0
        || !this.serverSummariesAvailable || this.loading) return;
    const key = inboxKey(read.kind, read.conversationId);
    const conversation = this.conversations.find(item => item.key === key);
    if (!conversation) return; // No forged or stale membership may be added.
    const version = (this.ownReadSyncVersions.get(key) ?? 0) + 1;
    this.ownReadSyncVersions.set(key, version);
    const inboxVersion = this.inboxVersion;
    ++this.summaryVersion; // Discard a global snapshot sampled before this commit.
    this.inboxApi.summaries([{ kind: conversation.kind, id: String(conversation.id) }])
      .pipe(timeout(10_000)).subscribe({
        next: values => {
          if (!this.isReceiptSessionCurrent() || inboxVersion !== this.inboxVersion
              || this.ownReadSyncVersions.get(key) !== version) return;
          const snapshot = values.find(item => inboxKey(item.kind, item.id) === key);
          if (!snapshot) return;
          this.conversations = orderInbox(this.conversations.map(item => {
            if (item.key !== key) return item;
            // A newer socket message arriving during the HTTP GET wins over
            // this snapshot; the periodic refresh will reconcile any gap.
            const newer = !!item.latestAt && (!snapshot.latestAt
              || Date.parse(item.latestAt) > Date.parse(snapshot.latestAt));
            if (newer || (item.latestMessageId !== undefined
              && item.latestMessageId !== null
              && (snapshot.latestMessageId === null
                || item.latestMessageId > snapshot.latestMessageId))) return item;
            return { ...item,
              latestText: snapshot.latestText ?? undefined,
              latestAt: snapshot.latestAt ?? undefined,
              latestMessageId: snapshot.latestMessageId,
              unreadCount: snapshot.unreadCount, newThisVisit: 0
            };
          }));
        },
        error: () => {
          // A transient GET failure must never clear unread badges locally.
        }
      });
  }

  private acceptPersistedPeerReadReceipt(
    receipt: { peerUsername: string; lastReadMessageId: number } | null
  ): void {
    const selected = this.selected;
    if (!this.isReceiptSessionCurrent() || !selected || selected.kind !== 'direct'
        || !receipt || typeof receipt.peerUsername !== 'string'
        || receipt.peerUsername.toLowerCase() !== String(selected.id).toLowerCase()
        || !Number.isSafeInteger(receipt.lastReadMessageId)
        || receipt.lastReadMessageId <= 0) return;
    // A server-sent receipt is not delivery, presence, or a local read guess:
    // it follows a committed durable cursor. Never decrease the known state.
    this.peerReadCursor = Math.max(this.peerReadCursor ?? 0, receipt.lastReadMessageId);
  }

  private refreshPeerReadReceipt(force = false): void {
    if (!this.isReceiptSessionCurrent()) {
      // A different account may have replaced the shared browser token.
      ++this.peerReceiptVersion;
      this.peerReadCursor = null;
      this.peerReceiptCheckedAt = 0;
      return;
    }
    const conversation = this.selected;
    if (!conversation || conversation.kind !== 'direct' || !this.isPageActive()) return;
    // One scoped lightweight GET at most every 15 seconds for the active peer.
    // Never request a receipt for every message or for community/session chats.
    if (!force && Date.now() - this.peerReceiptCheckedAt < 15_000) return;
    this.peerReceiptCheckedAt = Date.now();
    const version = ++this.peerReceiptVersion;
    const key = conversation.key;
    this.inboxApi.directReadReceipt(String(conversation.id)).pipe(timeout(10_000))
      .subscribe({
        next: receipt => {
          if (version !== this.peerReceiptVersion || this.selectedKey !== key
              || !this.isReceiptSessionCurrent()) return;
          if (receipt?.peerUsername?.toLowerCase() !== String(conversation.id).toLowerCase()
              || !Number.isSafeInteger(receipt.lastReadMessageId)
              || receipt.lastReadMessageId < 0) return;
          // Network responses can complete out of order. A read cursor is monotonic.
          this.peerReadCursor = Math.max(this.peerReadCursor ?? 0, receipt.lastReadMessageId);
        },
        error: () => {
          // Unknown remains unknown; no fake read/delivery receipt on HTTP error.
        }
      });
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
