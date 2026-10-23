import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { JwtHelperService } from '@auth0/angular-jwt';

import { environment } from 'src/environment/environment';
import { DirectChatMessage } from '../pages/model/direct-chat';
import { SessionMessage } from '../pages/model/session-message';
import { CommunityTimelineEntry } from './community-timeline.service';

interface ChatSocketEnvelope {
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
  if (typeof rawDate !== 'number' && !(typeof rawDate === 'string' && /^\\d{13}$/.test(rawDate.trim()))) {
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

@Injectable({
  providedIn: 'root'
})
export class DirectChatRealtimeService {
  private socket?: WebSocket;
  private reconnectTimer?: ReturnType<typeof setTimeout>;
  private shouldReconnect = false;
  private readonly jwtHelper = new JwtHelperService();

  private readonly messageSubject = new Subject<DirectChatMessage>();
  private readonly sessionMessageSubject = new Subject<SessionMessage>();
  private readonly communityMessageSubject = new Subject<CommunityTimelineEntry>();
  private readonly connectedSubject = new BehaviorSubject<boolean>(false);

  readonly messages$ = this.messageSubject.asObservable();
  readonly sessionMessages$ = this.sessionMessageSubject.asObservable();
  readonly communityMessages$ = this.communityMessageSubject.asObservable();
  readonly connected$ = this.connectedSubject.asObservable();

  connect(): void {
    const token = localStorage.getItem('t');
    if (!token || this.jwtHelper.isTokenExpired(token)) {
      this.disconnect();
      return;
    }

    if (
      this.socket?.readyState === WebSocket.OPEN
      || this.socket?.readyState === WebSocket.CONNECTING
    ) {
      return;
    }

    this.shouldReconnect = true;
    this.clearReconnectTimer();

    const websocketUrl =
      environment.apiUrl.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:')
      + '/ws/chat';

    this.socket = new WebSocket(websocketUrl);

    this.socket.onopen = () => {
      this.socket?.send(JSON.stringify({
        type: 'AUTH',
        token
      }));
    };

    this.socket.onmessage = event => {
      try {
        const envelope = JSON.parse(event.data) as ChatSocketEnvelope;

        if (envelope.type === 'AUTHENTICATED') {
          this.connectedSubject.next(true);
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
        // Ignore malformed realtime events; HTTP history remains authoritative.
      }
    };

    this.socket.onerror = () => {
      this.connectedSubject.next(false);
    };

    this.socket.onclose = () => {
      this.connectedSubject.next(false);
      this.socket = undefined;

      if (this.shouldReconnect) {
        this.scheduleReconnect();
      }
    };
  }

  disconnect(): void {
    this.shouldReconnect = false;
    this.clearReconnectTimer();
    this.connectedSubject.next(false);

    if (this.socket) {
      const socket = this.socket;
      this.socket = undefined;
      socket.close();
    }
  }

  private scheduleReconnect(): void {
    this.clearReconnectTimer();

    this.reconnectTimer = setTimeout(() => {
      const token = localStorage.getItem('t');
      if (!token || this.jwtHelper.isTokenExpired(token)) {
        this.disconnect();
        return;
      }

      this.connect();
    }, 3000);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }
}
