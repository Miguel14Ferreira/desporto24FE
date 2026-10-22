import { HttpErrorResponse } from '@angular/common/http';
import { appTranslate as t } from '../../i18n/i18n.service';
import { AfterViewChecked, ChangeDetectionStrategy, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { JwtHelperService } from '@auth0/angular-jwt';
import { Subscription, TimeoutError, forkJoin, finalize, retry, timeout } from 'rxjs';

import { DirectChatInfo, DirectChatMessage } from '../model/direct-chat';
import { DirectChatService } from '../../services/direct-chat.service';
import { CommunityService } from '../../services/community.service';
import { DirectChatRealtimeService } from '../../services/direct-chat-realtime.service';

@Component({
  selector: 'app-direct-chat',
  templateUrl: './direct-chat.component.html',
  styleUrls: ['./direct-chat.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false
})
export class DirectChatComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('messageList') messageList?: ElementRef<HTMLElement>;
  recipientUsername = '';
  currentUsername: string | null = null;
  messages: DirectChatMessage[] = [];
  chatInfo?: DirectChatInfo;

  loading = false;
  loadingOlder = false;
  hasOlderMessages = false;
  historyPage = 0;
  sending = false;
  friendshipActionLoading = false;
  errorMessage = '';
  actionError = '';
  actionSuccess = '';
  messageBody = '';
  showEmojiPicker = false;
  realtimeConnected = false;
  realtimeEverConnected = false;
  deliveryUncertain = false;
  deliveryChecking = false;
  private pendingDelivery?: { text: string; knownIds: Set<number>; startedAt: number };
  private scrollToBottomRequested = false;
  private restoreScroll?: { top: number; height: number };

  readonly emojis = ['😀', '😂', '😊', '😍', '🥳', '😎', '😉', '👍', '👏', '🙌', '🔥', '⚽', '🏀', '🎾', '🏓', '💪', '❤️', '✅'];

  private readonly jwtHelper = new JwtHelperService();
  private readonly dateTimeFormatter = new Intl.DateTimeFormat('pt-PT', {
    dateStyle: 'short',
    timeStyle: 'short'
  });
  private readonly realtimeSubscriptions = new Subscription();
  private initialRealtimeConnection = true;

  constructor(
    private route: ActivatedRoute,
    private chatService: DirectChatService,
    private communityService: CommunityService,
    private realtimeService: DirectChatRealtimeService
  ) {}

  ngOnInit(): void {
    this.currentUsername = this.readCurrentUsername();
    this.recipientUsername = this.resolveRecipient();

    if (!this.recipientUsername) {
      this.errorMessage = t('feedback.chat.invalid');
      return;
    }

    this.load();
    this.realtimeService.connect();

    this.realtimeSubscriptions.add(
      this.realtimeService.messages$.subscribe(message => {
        if (!this.belongsToCurrentConversation(message)) {
          return;
        }

        const alreadyPresent = message.id !== null
          && this.messages.some(existing => existing.id === message.id);

        if (!alreadyPresent) {
          const follow = this.isNearBottom() || this.isOwnMessage(message);
          this.messages = this.sorted([...this.messages, message]);
          if (follow) this.scrollToBottomRequested = true;
        }
        if (this.deliveryUncertain && this.matchesPendingDelivery(message)) {
          this.confirmPendingDelivery();
        }
      })
    );

    this.realtimeSubscriptions.add(
      this.realtimeService.connected$.subscribe(connected => {
        this.realtimeConnected = connected;
        if (!connected) return;
        this.realtimeEverConnected = true;

        if (this.initialRealtimeConnection) {
          this.initialRealtimeConnection = false;
          return;
        }

        this.refreshMessages();
      })
    );
  }

  ngOnDestroy(): void {
    this.realtimeSubscriptions.unsubscribe();
  }

  ngAfterViewChecked(): void {
    const el = this.messageList?.nativeElement;
    if (!el) return;
    if (this.restoreScroll) {
      el.scrollTop = this.restoreScroll.top + el.scrollHeight - this.restoreScroll.height;
      this.restoreScroll = undefined;
      return;
    }
    if (this.scrollToBottomRequested) {
      el.scrollTop = el.scrollHeight;
      this.scrollToBottomRequested = false;
    }
  }

  private isNearBottom(): boolean {
    const el = this.messageList?.nativeElement;
    return !el || el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }

  load(): void {
    if (!this.recipientUsername) {
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    forkJoin({
      messages: this.chatService.recentHistory(this.recipientUsername),
      info: this.chatService.info(this.recipientUsername)
    })
      .pipe(
        timeout(10_000),
        retry({ count: 1 }),
        finalize(() => this.loading = false)
      )
      .subscribe({
        next: result => {
          // A WebSocket message can arrive before this HTTP request finishes.
          // Merge instead of overwriting it with a potentially older snapshot.
          this.messages = this.sorted([
            ...this.messages.filter(existing => !result.messages.content.some(incoming =>
              existing.id !== null && incoming.id === existing.id)),
            ...result.messages.content
          ]);
          this.chatInfo = result.info;
          this.historyPage = 0;
          this.hasOlderMessages = !result.messages.last;
          this.scrollToBottomRequested = true;
        },
        error: error => {
          this.messages = [];
          this.errorMessage = this.errorFrom(error, t('feedback.chat.loadError'));
        }
      });
  }

  refreshMessages(): void {
    if (!this.recipientUsername) {
      return;
    }

    this.chatService.recentHistory(this.recipientUsername)
      .pipe(
        timeout(10_000),
        retry({ count: 1 })
      )
      .subscribe({
        next: page => {
          const follow = this.isNearBottom();
          this.messages = this.sorted([...this.messages.filter(message => !page.content.some(recent => recent.id === message.id)), ...page.content]);
          if (follow) this.scrollToBottomRequested = true;
          const confirmed = this.messages.find(message => this.matchesPendingDelivery(message));
          if (confirmed) this.confirmPendingDelivery();
        }
      });
  }

  loadOlderMessages(): void {
    if (!this.recipientUsername || this.loadingOlder || !this.hasOlderMessages) {
      return;
    }

    this.loadingOlder = true;
    const el = this.messageList?.nativeElement;
    const before = el ? { top: el.scrollTop, height: el.scrollHeight } : undefined;
    const nextPage = this.historyPage + 1;
    this.chatService.recentHistory(this.recipientUsername, nextPage)
      .pipe(timeout(10_000), finalize(() => this.loadingOlder = false))
      .subscribe({
        next: page => {
          this.messages = this.sorted([...this.messages.filter(message => !page.content.some(older => older.id === message.id)), ...page.content]);
          this.historyPage = nextPage;
          this.hasOlderMessages = !page.last;
          if (before) this.restoreScroll = before;
        },
        error: error => {
          this.actionError = this.errorFrom(error, t('feedback.chat.loadError'));
        }
      });
  }

  onEnter(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;

    if (keyboardEvent.shiftKey || keyboardEvent.isComposing || keyboardEvent.keyCode === 229) {
      return;
    }

    keyboardEvent.preventDefault();
    this.sendMessage();
  }

  sendMessage(): void {
    const text = this.messageBody.trim();

    if (!this.recipientUsername || this.sending || this.deliveryUncertain || this.chatInfo?.chatBlocked) {
      return;
    }

    if (!text) {
      this.actionError = t('feedback.chat.writeFirst');
      return;
    }

    if (text.length > 2000) {
      this.actionError = t('feedback.chat.messageLong');
      return;
    }

    this.sending = true;
    this.actionError = '';
    this.actionSuccess = '';
    const pending = {
      text,
      knownIds: new Set(this.messages.filter(message => message.id !== null).map(message => message.id as number)),
      startedAt: Date.now()
    };

    this.chatService.send(this.recipientUsername, text)
      .pipe(
        timeout(10_000),
        finalize(() => this.sending = false)
      )
      .subscribe({
        next: message => {
          const alreadyPresent = message.id !== null
            && this.messages.some(existing => existing.id === message.id);

          if (!alreadyPresent) {
            this.messages = this.sorted([...this.messages, message]);
          }

          this.messageBody = '';
          this.showEmojiPicker = false;
          this.scrollToBottomRequested = true;
          this.deliveryUncertain = false;
          this.pendingDelivery = undefined;
        },
        error: error => {
          if (this.isUncertainSendError(error)) {
            // A timeout can happen *after* the server committed the message.
            // Never automatically retry a POST that could have succeeded.
            this.pendingDelivery = pending;
            this.deliveryUncertain = true;
            this.actionError = t('chat.sendUncertain');
            this.verifyDelivery();
          } else {
            this.actionError = this.errorFrom(error, t('feedback.chat.sendError'));
          }
        }
      });
  }

  verifyDelivery(): void {
    if (!this.deliveryUncertain || this.deliveryChecking || !this.pendingDelivery) return;
    const alreadyDelivered = this.messages.find(message => this.matchesPendingDelivery(message));
    if (alreadyDelivered) {
      this.confirmPendingDelivery();
      return;
    }
    this.deliveryChecking = true;
    this.chatService.recentHistory(this.recipientUsername)
      .pipe(timeout(10_000), finalize(() => this.deliveryChecking = false))
      .subscribe({
        next: page => {
          const found = page.content.find(message => this.matchesPendingDelivery(message));
          if (found) {
            this.messages = this.sorted([...this.messages.filter(m => m.id !== found.id), found]);
            this.confirmPendingDelivery();
          } else {
            this.actionError = t('chat.sendUnconfirmed');
          }
        },
        error: () => this.actionError = t('chat.verifyUnavailable')
      });
  }

  /**
   * Deliberately opt out of the ambiguous-send guard. The original text stays
   * in the composer; the user is warned it may already have been delivered.
   */
  resumeAfterUncertainSend(): void {
    if (this.deliveryChecking) return;
    this.deliveryUncertain = false;
    this.pendingDelivery = undefined;
    this.actionError = t('chat.sendRetryWarning');
  }

  private confirmPendingDelivery(): void {
    this.deliveryUncertain = false;
    this.pendingDelivery = undefined;
    this.messageBody = '';
    this.actionError = '';
    this.actionSuccess = t('chat.sendConfirmed');
    this.scrollToBottomRequested = true;
  }

  private matchesPendingDelivery(message: DirectChatMessage): boolean {
    const pending = this.pendingDelivery;
    if (!pending || message.id === null || pending.knownIds.has(message.id)) return false;
    if (!this.currentUsername || !this.isOwnMessage(message)) return false;
    if (message.username2.toLowerCase() !== this.recipientUsername.toLowerCase()) return false;
    const sentAt = this.timestamp(message);
    // Unreliable or absent timestamps should not be treated as proof of delivery.
    return sentAt >= pending.startedAt - 60_000 && message.text === pending.text;
  }

  private isUncertainSendError(error: unknown): boolean {
    return error instanceof TimeoutError
      || error instanceof HttpErrorResponse
         && (error.status === 0 || error.status === 408 || error.status === 429 || error.status >= 500);
  }

  toggleEmojiPicker(): void {
    this.showEmojiPicker = !this.showEmojiPicker;
  }

  addEmoji(emoji: string): void {
    if (this.messageBody.length + emoji.length <= 2000) {
      this.messageBody += emoji;
      this.showEmojiPicker = false;
    }
  }

  isOwnMessage(message: DirectChatMessage): boolean {
    return Boolean(
      this.currentUsername
      && message.username1.toLowerCase() === this.currentUsername.toLowerCase()
    );
  }

  isBlockedByMe(): boolean {
    return Boolean(
      this.chatInfo?.chatBlocked
      && this.currentUsername
      && this.chatInfo.whoBlocked?.toLowerCase() === this.currentUsername.toLowerCase()
    );
  }

  toggleChatBlock(): void {
    if (!this.recipientUsername || this.friendshipActionLoading) {
      return;
    }

    if (this.chatInfo?.chatBlocked && !this.isBlockedByMe()) {
      this.actionError = t('feedback.chat.blockedOther');
      this.actionSuccess = '';
      return;
    }

    const shouldUnblock = this.isBlockedByMe();
    const request$ = shouldUnblock
      ? this.communityService.unblockFriend(this.recipientUsername)
      : this.communityService.blockFriend(this.recipientUsername);

    this.friendshipActionLoading = true;
    this.actionError = '';
    this.actionSuccess = '';

    request$
      .pipe(
        timeout(10_000),
        finalize(() => this.friendshipActionLoading = false)
      )
      .subscribe({
        next: () => {
          this.chatInfo = shouldUnblock
            ? { chatBlocked: false, whoBlocked: null }
            : { chatBlocked: true, whoBlocked: this.currentUsername };
          this.actionSuccess = shouldUnblock
            ? t('feedback.chat.unblocked')
            : t('feedback.chat.blocked');
        },
        error: error => {
          this.actionError = this.errorFrom(
            error,
            shouldUnblock ? t('feedback.chat.unblockError') : t('feedback.chat.blockError')
          );
        }
      });
  }

  blockedMessage(): string {
    if (!this.chatInfo?.chatBlocked) {
      return '';
    }

    if (this.isBlockedByMe()) {
      return t('feedback.chat.blockedByMe');
    }

    return t('feedback.chat.blockedGeneric');
  }

  messageDate(message: DirectChatMessage): string {
    const raw = message.date || message.dataDisplay;
    if (!raw) {
      return '';
    }

    const parsed = Date.parse(raw);
    if (Number.isNaN(parsed)) {
      return raw;
    }

    return this.dateTimeFormatter.format(new Date(parsed));
  }

  private sorted(messages: DirectChatMessage[]): DirectChatMessage[] {
    return [...messages].sort((a, b) => this.timestamp(a) - this.timestamp(b));
  }

  private belongsToCurrentConversation(message: DirectChatMessage): boolean {
    if (!this.currentUsername || !this.recipientUsername) {
      return false;
    }

    const current = this.currentUsername.toLowerCase();
    const recipient = this.recipientUsername.toLowerCase();
    const sender = message.username1.toLowerCase();
    const receiver = message.username2.toLowerCase();

    return (sender === current && receiver === recipient)
      || (sender === recipient && receiver === current);
  }

  private resolveRecipient(): string {
    const direct = this.route.snapshot.paramMap.get('username');
    if (direct) {
      return direct;
    }

    const username1 = this.route.snapshot.paramMap.get('username1');
    const username2 = this.route.snapshot.paramMap.get('username2');

    if (!username1 || !username2) {
      return '';
    }

    if (this.currentUsername?.toLowerCase() === username1.toLowerCase()) {
      return username2;
    }

    if (this.currentUsername?.toLowerCase() === username2.toLowerCase()) {
      return username1;
    }

    return username2;
  }

  private timestamp(message: DirectChatMessage): number {
    const raw = message.date || message.dataDisplay;
    if (!raw) {
      return 0;
    }

    const parsed = Date.parse(raw);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  private readCurrentUsername(): string | null {
    const token = localStorage.getItem('t');
    if (!token) {
      return null;
    }

    try {
      return this.jwtHelper.decodeToken(token)?.sub ?? null;
    } catch {
      return null;
    }
  }

  private errorFrom(error: HttpErrorResponse, fallback: string): string {
    const apiMessage = error.error?.message;
    return typeof apiMessage === 'string' && apiMessage.trim() ? apiMessage : fallback;
  }
}
