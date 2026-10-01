import { HttpErrorResponse } from '@angular/common/http';
import { appTranslate as t } from '../../i18n/i18n.service';
import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { JwtHelperService } from '@auth0/angular-jwt';
import { Subscription, forkJoin, finalize, retry, timeout } from 'rxjs';

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
export class DirectChatComponent implements OnInit, OnDestroy {
  recipientUsername = '';
  currentUsername: string | null = null;
  messages: DirectChatMessage[] = [];
  chatInfo?: DirectChatInfo;

  loading = false;
  sending = false;
  friendshipActionLoading = false;
  errorMessage = '';
  actionError = '';
  actionSuccess = '';
  messageBody = '';
  showEmojiPicker = false;

  readonly emojis = ['😀', '😂', '😊', '😍', '🥳', '😎', '😉', '👍', '👏', '🙌', '🔥', '⚽', '🏀', '🎾', '🏓', '💪', '❤️', '✅'];

  private readonly jwtHelper = new JwtHelperService();
  private readonly realtimeSubscriptions = new Subscription();

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
          this.messages = this.sorted([...this.messages, message]);
        }
      })
    );

    this.realtimeSubscriptions.add(
      this.realtimeService.connected$.subscribe(connected => {
        if (connected) {
          this.refreshMessages();
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.realtimeSubscriptions.unsubscribe();
  }

  load(): void {
    if (!this.recipientUsername) {
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    forkJoin({
      messages: this.chatService.history(this.recipientUsername),
      info: this.chatService.info(this.recipientUsername)
    })
      .pipe(
        timeout(10_000),
        retry({ count: 1 }),
        finalize(() => this.loading = false)
      )
      .subscribe({
        next: result => {
          this.messages = this.sorted(result.messages);
          this.chatInfo = result.info;
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

    this.chatService.history(this.recipientUsername)
      .pipe(
        timeout(10_000),
        retry({ count: 1 })
      )
      .subscribe({
        next: messages => {
          this.messages = this.sorted(messages);
        }
      });
  }

  onEnter(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;

    if (keyboardEvent.shiftKey) {
      return;
    }

    keyboardEvent.preventDefault();
    this.sendMessage();
  }

  sendMessage(): void {
    const text = this.messageBody.trim();

    if (!this.recipientUsername || this.sending || this.chatInfo?.chatBlocked) {
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

    this.chatService.send(this.recipientUsername, text)
      .pipe(finalize(() => this.sending = false))
      .subscribe({
        next: message => {
          this.messages = this.sorted([...this.messages, message]);
          this.messageBody = '';
          this.showEmojiPicker = false;
        },
        error: error => {
          this.actionError = this.errorFrom(error, t('feedback.chat.sendError'));
        }
      });
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
      .pipe(finalize(() => this.friendshipActionLoading = false))
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

    return new Intl.DateTimeFormat('pt-PT', {
      dateStyle: 'short',
      timeStyle: 'short'
    }).format(new Date(parsed));
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
