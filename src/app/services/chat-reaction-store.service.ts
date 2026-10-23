import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject } from 'rxjs';
import { JwtHelperService } from '@auth0/angular-jwt';
import { environment } from 'src/environment/environment';
import { ChatReactionEvent, DirectChatRealtimeService } from './direct-chat-realtime.service';

export type ChatReactionKind = 'direct' | 'session' | 'community';
export interface ChatReactionSummary {
  messageId: number;
  counts: Record<string, number>;
  myEmoji: string | null;
}
export const CHAT_REACTION_EMOJIS = ['👍', '❤️', '😂', '🎉', '👏', '🔥'] as const;

/**
 * Batches all reaction reads triggered by a rendered message list into a
 * single GET per conversation, rather than one HTTP request per message.
 * All changes remain server-authoritative; ambiguous PUTs are never retried.
 */
@Injectable({ providedIn: 'root' })
export class ChatReactionStoreService {
  private readonly base = environment.apiUrl + '/api/messages/reactions';
  private readonly jwt = new JwtHelperService();
  private readonly cache = new Map<string, ChatReactionSummary>();
  private readonly watchers = new Map<string, number>();
  private readonly pending = new Map<string, Set<number>>();
  private readonly busy = new Set<string>();
  private scheduled = false;
  private connectedOnce = false;
  readonly changed = new BehaviorSubject<number>(0);

  constructor(private readonly http: HttpClient, realtime: DirectChatRealtimeService) {
    realtime.reactions$.subscribe(event => this.applySocketEvent(event));
    realtime.connected$.subscribe(connected => {
      if (!connected) return;
      if (!this.connectedOnce) { this.connectedOnce = true; return; }
      this.cache.clear();
      for (const key of this.watchers.keys()) {
        const [kind, id, rawMessage] = key.split(':');
        this.queue(kind as ChatReactionKind, id, Number(rawMessage));
      }
      this.changed.next(this.changed.value + 1);
    });
  }

  private conversation(kind: ChatReactionKind, id: string | number): string {
    return kind + ':' + String(id).toLowerCase();
  }

  private key(kind: ChatReactionKind, id: string | number, messageId: number): string {
    return this.conversation(kind, id) + ':' + messageId;
  }

  get(kind: ChatReactionKind, id: string | number, messageId: number): ChatReactionSummary | undefined {
    return this.cache.get(this.key(kind, id, messageId));
  }

  isBusy(kind: ChatReactionKind, id: string | number, messageId: number): boolean {
    return this.busy.has(this.key(kind, id, messageId));
  }

  watch(kind: ChatReactionKind, id: string | number, messageId: number): void {
    if (!Number.isSafeInteger(messageId) || messageId <= 0) return;
    const key = this.key(kind, id, messageId);
    this.watchers.set(key, (this.watchers.get(key) || 0) + 1);
    if (!this.cache.has(key)) this.queue(kind, String(id).toLowerCase(), messageId);
  }

  unwatch(kind: ChatReactionKind, id: string | number, messageId: number): void {
    const key = this.key(kind, id, messageId);
    const count = this.watchers.get(key) || 0;
    if (count <= 1) this.watchers.delete(key);
    else this.watchers.set(key, count - 1);
  }

  private queue(kind: ChatReactionKind, id: string, messageId: number): void {
    const conv = this.conversation(kind, id);
    const batch = this.pending.get(conv) || new Set<number>();
    batch.add(messageId);
    this.pending.set(conv, batch);
    if (this.scheduled) return;
    this.scheduled = true;
    queueMicrotask(() => this.flush());
  }

  private flush(): void {
    this.scheduled = false;
    const pending = [...this.pending.entries()];
    this.pending.clear();
    for (const [conversation, ids] of pending) {
      const separator = conversation.indexOf(':');
      const kind = conversation.slice(0, separator) as ChatReactionKind;
      const id = conversation.slice(separator + 1);
      const active = [...ids].filter(msgId => this.watchers.has(this.key(kind, id, msgId)));
      for (let start = 0; start < active.length; start += 100) {
        const page = active.slice(start, start + 100);
        const params = new HttpParams().set('ids', page.join(','));
        this.http.get<ChatReactionSummary[]>(this.url(kind, id), { params }).subscribe({
          next: summaries => {
            const byId = new Map(summaries.map(item => [item.messageId, item]));
            for (const msgId of page) {
              const key = this.key(kind, id, msgId);
              if (this.watchers.has(key)) this.cache.set(key, byId.get(msgId)
                || { messageId: msgId, counts: {}, myEmoji: null });
            }
            this.changed.next(this.changed.value + 1);
          },
          error: () => {
            // Do not fabricate an empty aggregate on failed authorization/network.
            this.changed.next(this.changed.value + 1);
          }
        });
      }
    }
  }

  toggle(kind: ChatReactionKind, id: string | number, messageId: number,
         emoji: string, onError: () => void): void {
    if (!CHAT_REACTION_EMOJIS.includes(emoji as typeof CHAT_REACTION_EMOJIS[number])) return;
    const key = this.key(kind, id, messageId);
    const current = this.cache.get(key);
    if (!current || this.busy.has(key)) return;
    this.busy.add(key);
    const url = this.url(kind, id) + '/' + messageId;
    const request = current.myEmoji === emoji
      ? this.http.delete<ChatReactionSummary>(url)
      : this.http.put<ChatReactionSummary>(url, { emoji });
    request.subscribe({
      next: result => {
        this.cache.set(key, result);
        this.busy.delete(key);
        this.changed.next(this.changed.value + 1);
      },
      error: () => {
        this.busy.delete(key);
        onError();
        this.changed.next(this.changed.value + 1);
      }
    });
  }

  private url(kind: ChatReactionKind, id: string | number): string {
    return this.base + '/' + encodeURIComponent(kind) + '/' + encodeURIComponent(String(id));
  }

  private currentUsername(): string {
    try {
      const token = localStorage.getItem('t');
      return token ? (this.jwt.decodeToken(token)?.sub || '').toLowerCase() : '';
    } catch { return ''; }
  }

  private applySocketEvent(event: ChatReactionEvent): void {
    if (!event || !Number.isSafeInteger(event.messageId) || event.messageId <= 0
        || !['direct', 'session', 'community'].includes(event.kind)) return;
    const key = this.key(event.kind, event.conversationId, event.messageId);
    const current = this.cache.get(key);
    if (!current) {
      if (this.watchers.has(key)) this.queue(event.kind, event.conversationId, event.messageId);
      return;
    }
    this.cache.set(key, {
      messageId: event.messageId,
      counts: event.counts || {},
      myEmoji: this.currentUsername() === event.actorUsername?.toLowerCase()
        ? event.emoji : current.myEmoji
    });
    this.changed.next(this.changed.value + 1);
  }
}
