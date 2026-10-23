import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { JwtHelperService } from '@auth0/angular-jwt';

import { environment } from 'src/environment/environment';
import { DirectChatMessage } from '../pages/model/direct-chat';
import { SessionMessage } from '../pages/model/session-message';
import { CommunityTimelineEntry } from './community-timeline.service';

export interface ChatReactionEvent {
  kind: 'direct' | 'session' | 'community';
  conversationId: string;
  messageId: number;
  counts: Record<string, number>;
  actorUsername: string;
  emoji: string | null;
}

/** Emitted by the authenticated backend only after the read cursor commits. */
export interface DirectChatReadReceiptEvent {
  peerUsername: string;
  lastReadMessageId: number;
}

export interface ChatTypingEvent {
  kind: 'direct' | 'session' | 'community';
  conversationId: string;
  username: string;
  active: boolean;
}

interface ChatSocketEnvelope {
  typing?: ChatTypingEvent;
  reaction?: ChatReactionEvent;
  receipt?: DirectChatReadReceiptEvent;
  type?: string;
  message?: DirectChatMessage | SessionMessage | CommunityTimelineEntry;
}

/**
 * The dedicated websocket gateway serializes java.util.Date as Unix epoch
 * milliseconds. Angular's HTTP mapper uses ISO dates, so keep a single date
 * shape before passing a live direct message to either chat UI.
 *
 * Never invent an arrival timestamp: history from the backend is authoritative.
 */
export function normalizeDirectChatRealtimeMessage(message: DirectChatMessage): DirectChatMessage {
  const rawDate: unknown = message.date;
  if (typeof rawDate !== 'number' && !(typeof rawDate === 'string' && /^\d{13}$/.test(rawDate.trim()))) {
    return message;
  }
  const milliseconds = Number(rawDate);
  const date = new Date(milliseconds);
  return {
    ...message,
    date: Number.isFinite(milliseconds) && milliseconds > 0 && Number.isFinite(date.getTime())
      ? date.toISOString() : null
  };
}

/** A bounded exponential reconnect policy; only successful AUTH resets it. */
export function chatReconnectDelayMs(attempt: number): number {
  const n = Number.isFinite(attempt) ? Math.max(0, Math.floor(attempt)) : 0;
  return Math.min(30_000, 3_000 * 2 ** Math.min(n, 4));
}

@Injectable({
  providedIn: 'root'
})
export class DirectChatRealtimeService {
  private socket?: WebSocket;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private shouldReconnect = false;
  private activeToken: string | null = null;
  private reconnectAttempts = 0;
  private readonly jwtHelper = new JwtHelperService();

  private readonly messageSubject = new Subject<DirectChatMessage>();
  private readonly sessionMessageSubject = new Subject<SessionMessage>();
  private readonly communityMessageSubject = new Subject<CommunityTimelineEntry>();
  private readonly reactionSubject = new Subject<ChatReactionEvent>();
  private readonly typingSubject = new Subject<ChatTypingEvent>();
  private readonly readReceiptSubject = new Subject<DirectChatReadReceiptEvent>();
  private readonly connectedSubject = new BehaviorSubject<boolean>(false);

  readonly messages$ = this.messageSubject.asObservable();
  readonly sessionMessages$ = this.sessionMessageSubject.asObservable();
  readonly communityMessages$ = this.communityMessageSubject.asObservable();
  readonly reactions$ = this.reactionSubject.asObservable();
  readonly typing$ = this.typingSubject.asObservable();
  readonly readReceipts$ = this.readReceiptSubject.asObservable();
  readonly connected$ = this.connectedSubject.asObservable();

  connect(): void {
    const token = localStorage.getItem('t');
    if (!token || this.jwtHelper.isTokenExpired(token)) {
      this.disconnect();
      return;
    }

    // A shared singleton can outlive logout/login and route changes. Never
    // reuse a socket authorized with the previous account's token.
    if (this.socket && this.activeToken !== token) this.disconnect();

    if (this.socket?.readyState === WebSocket.OPEN
        || this.socket?.readyState === WebSocket.CONNECTING) return;

    this.shouldReconnect = true;
    this.clearReconnectTimer();
    const url = environment.apiUrl.replace(/^http:/, 'ws:')
      .replace(/^https:/, 'wss:') + '/ws/chat';

    let socket: WebSocket;
    try {
      socket = new WebSocket(url);
    } catch {
      // Browsers may fail synchronously when offline or the endpoint is invalid.
      this.connectedSubject.next(false);
      this.scheduleReconnect();
      return;
    }

    this.socket = socket;
    this.activeToken = token;
    let authenticated = false;
    const isCurrent = () => this.shouldReconnect && this.socket === socket;

    socket.onopen = () => {
      if (!isCurrent()) return;
      if (localStorage.getItem('t') !== token) {
        this.disconnect();
        return;
      }
      try {
        socket.send(JSON.stringify({ type: 'AUTH', token }));
      } catch {
        socket.close();
      }
    };

    socket.onmessage = event => {
      if (!isCurrent()) return;
      // Do not deliver messages belonging to an earlier signed-in identity,
      // even if Angular has not yet reacted to the localStorage token change.
      if (localStorage.getItem('t') !== token) {
        this.disconnect();
        return;
      }
      try {
        const envelope = JSON.parse(event.data) as ChatSocketEnvelope;

        if (envelope.type === 'AUTHENTICATED') {
          authenticated = true;
          this.reconnectAttempts = 0;
          this.connectedSubject.next(true);
          return;
        }
        // The backend requires AUTH before delivering private messages.
        // Apply the same contract on the client, including typing/reactions.
        if (!authenticated) return;

        if (envelope.type === 'CHAT_TYPING' && envelope.typing) {
          const event = envelope.typing;
          if (['direct', 'session', 'community'].includes(event.kind)
              && typeof event.conversationId === 'string'
              && typeof event.username === 'string'
              && typeof event.active === 'boolean') this.typingSubject.next(event);
          return;
        }

        if (envelope.type === 'CHAT_REACTION_CHANGED' && envelope.reaction) {
          this.reactionSubject.next(envelope.reaction);
          return;
        }

        if (envelope.type === 'CHAT_READ_RECEIPT' && envelope.receipt) {
          const receipt = envelope.receipt;
          if (typeof receipt.peerUsername === 'string'
              && receipt.peerUsername.length > 0
              && Number.isSafeInteger(receipt.lastReadMessageId)
              && receipt.lastReadMessageId > 0) {
            this.readReceiptSubject.next(receipt);
          }
          return;
        }

        if (envelope.type === 'CHAT_MESSAGE' && envelope.message) {
          this.messageSubject.next(normalizeDirectChatRealtimeMessage(envelope.message as DirectChatMessage));
          return;
        }

        if (envelope.type === 'SESSION_CHAT_MESSAGE' && envelope.message) {
          this.sessionMessageSubject.next(envelope.message as SessionMessage);
          return;
        }

        if (envelope.type === 'COMMUNITY_CHAT_MESSAGE' && envelope.message) {
          this.communityMessageSubject.next(envelope.message as CommunityTimelineEntry);
        }
      } catch {
        // Ignore malformed events. HTTP history remains authoritative.
      }
    };

    socket.onerror = () => {
      if (isCurrent()) this.connectedSubject.next(false);
    };

    socket.onclose = event => {
      if (this.socket !== socket) return; // Ignore late events from old sockets.
      this.socket = undefined;
      this.activeToken = null;
      this.connectedSubject.next(false);
      if (!this.shouldReconnect) return;

      // The gateway rejects invalid/revoked credentials with 1003. Do not
      // hammer it in a loop: a new explicit connect after login can retry.
      if (event.code === 1003) {
        this.shouldReconnect = false;
        this.clearReconnectTimer();
        return;
      }
      this.scheduleReconnect();
    };
  }

  /** No HTTP fallback: ephemeral only, and never queued across reconnects. */
  sendTyping(kind: ChatTypingEvent['kind'], id: string | number, active: boolean): void {
    if (!this.connectedSubject.value || this.socket?.readyState !== WebSocket.OPEN) return;
    this.socket.send(JSON.stringify({ type: 'CHAT_TYPING', kind, id: String(id), active }));
  }

  disconnect(): void {
    this.shouldReconnect = false;
    this.reconnectAttempts = 0;
    this.clearReconnectTimer();
    this.connectedSubject.next(false);

    const previous = this.socket;
    this.socket = undefined;
    this.activeToken = null;
    // Detach the old identity before closing; its delayed callbacks cannot
    // clear a newer socket or schedule a reconnect with the wrong token.
    previous?.close();
  }

  private scheduleReconnect(): void {
    if (!this.shouldReconnect) return;
    this.clearReconnectTimer();
    const wait = chatReconnectDelayMs(this.reconnectAttempts++);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      if (!this.shouldReconnect) return;
      this.connect();
    }, wait);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }
}
