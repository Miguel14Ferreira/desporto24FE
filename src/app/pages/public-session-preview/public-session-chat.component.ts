import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, OnDestroy, OnInit, SimpleChanges } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { finalize, Subscription, timeout } from 'rxjs';

import { environment } from 'src/environment/environment';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { SessionMessage } from '../model/session-message';
import { DirectChatRealtimeService } from '../../services/direct-chat-realtime.service';

/**
 * Session chat in signed/public invitations.
 *
 * The invitation and its guest receipt are NOT chat credentials. Only the
 * authenticated creator or ACTIVE participant may read/send; the existing
 * SessionChatService authorizes every GET/POST on the backend. In particular
 * never fetch chat messages for an anonymous visitor or use a guest token.
 */
@Component({
  selector: 'app-public-session-chat',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TranslatePipe],
  templateUrl: './public-session-chat.component.html',
  styleUrls: ['./public-session-chat.component.css']
})
export class PublicSessionChatComponent implements OnInit, OnChanges, OnDestroy {
  @Input({required:true}) sessionId!: number;
  @Input() authenticated = false;
  @Input() guestConfirmed = false;
  @Input() returnUrl: string | null = null;
  @Input() startsAt: string | null = null;

  messages: SessionMessage[] = [];
  messageText = '';
  allowed = false;
  loading = false;
  sending = false;
  sendError = '';
  readError = '';
  private readonly subscriptions = new Subscription();
  private interval?: ReturnType<typeof setInterval>;
  private currentId: number | null = null;
  private checking = false;
  private disposed = false;

  constructor(
    private readonly http: HttpClient,
    private readonly realtime: DirectChatRealtimeService
  ) {}

  ngOnInit(): void {
    this.subscriptions.add(this.realtime.sessionMessages$.subscribe(message => {
      if (!this.allowed || message.sessionId !== this.sessionId) return;
      if (!this.messages.some(existing => existing.id === message.id)) {
        this.messages = [...this.messages, message].sort((a,b) => a.id - b.id);
      } else {
        this.messages = this.messages.map(existing =>
          existing.id === message.id ? message : existing);
      }
    }));
    this.interval = setInterval(() => {
      if (!this.disposed && this.authenticated && document.visibilityState !== 'hidden') {
        this.loadMessages(false);
      }
    }, 15000);
    this.initForSession();
  }

  ngOnChanges(_changes: SimpleChanges): void {
    if (this.interval) this.initForSession();
  }

  get chatOpen(): boolean {
    const starts = Date.parse(this.startsAt || '');
    return Number.isFinite(starts) && starts > Date.now();
  }

  get canSend(): boolean {
    return this.allowed && this.chatOpen && !this.sending && !this.loading;
  }

  private initForSession(): void {
    if (this.disposed) return;
    if (!this.authenticated || !Number.isSafeInteger(this.sessionId) || this.sessionId <= 0) {
      this.currentId = null;
      this.allowed = false;
      this.messages = [];
      this.readError = '';
      return;
    }
    if (this.currentId !== this.sessionId) {
      this.currentId = this.sessionId;
      this.allowed = false;
      this.messages = [];
      this.readError = '';
      this.messageText = '';
    }
    this.loadMessages(true);
  }

  loadMessages(indicateLoading = false): void {
    if (!this.authenticated || !this.chatOpen || !this.currentId || this.checking) return;
    const requestId = this.currentId;
    this.checking = true;
    if (indicateLoading) this.loading = true;
    this.http.get<SessionMessage[]>(environment.apiUrl + '/api/sessions/' +
      requestId + '/messages').pipe(timeout(10000),finalize(() => {
        this.checking = false;
        this.loading = false;
      })).subscribe({
      next: rows => {
        if (this.disposed || requestId !== this.currentId || !this.authenticated) return;
        this.allowed = true;
        this.readError = '';
        this.messages = Array.isArray(rows)
          ? rows.filter(m => m && m.sessionId === requestId && Number.isSafeInteger(m.id))
              .sort((a,b) => a.id - b.id)
          : [];
        this.realtime.connect();
      },
      error: (error: unknown) => {
        if (this.disposed || requestId !== this.currentId) return;
        if (error instanceof HttpErrorResponse && [401,403,404].includes(error.status)) {
          // Attendance was cancelled, the caller is not enrolled, or the game
          // is no longer available. Do not keep previously loaded chat visible.
          this.allowed = false;
          this.messages = [];
          this.readError = '';
        } else {
          this.readError = 'publicSession.chatLoadError';
        }
      }
    });
  }

  sendMessage(): void {
    const body = this.messageText.trim();
    if (!this.canSend || !body || body.length > 2000) return;
    const id = this.currentId;
    if (!id) return;
    this.sending = true;
    this.sendError = '';
    this.http.post<SessionMessage>(environment.apiUrl + '/api/sessions/' +
      id + '/messages', {body}).pipe(timeout(10000),finalize(() => {
        this.sending = false;
      })).subscribe({
      next: row => {
        if (this.disposed || id !== this.currentId) return;
        if (this.messageText.trim() === body) this.messageText = '';
        if (row && row.sessionId === id && !this.messages.some(m => m.id === row.id)) {
          this.messages = [...this.messages, row].sort((a,b) => a.id - b.id);
        }
      },
      error: (error: unknown) => {
        if (this.disposed || id !== this.currentId) return;
        if (error instanceof HttpErrorResponse && [401,403,404].includes(error.status)) {
          this.allowed = false;
          this.messages = [];
          this.sendError = '';
        } else {
          // Retain the draft; do not automatically retry an uncertain POST.
          this.sendError = 'publicSession.chatSendError';
          this.loadMessages(false);
        }
      }
    });
  }

  onMessageKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
    event.preventDefault();
    this.sendMessage();
  }

  ngOnDestroy(): void {
    this.disposed = true;
    if (this.interval) clearInterval(this.interval);
    this.subscriptions.unsubscribe();
  }
}
