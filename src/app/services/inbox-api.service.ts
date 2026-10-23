import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environment/environment';

export type InboxKind = 'direct' | 'community' | 'session';

export interface InboxReference {
  kind: InboxKind;
  id: string;
}

export interface InboxSummary extends InboxReference {
  latestMessageId: number | null;
  latestText: string | null;
  latestSender: string | null;
  latestAt: string | null;
  unreadCount: number;
}

export interface ChatSearchHit {
  id: number;
  sender: string;
  text: string;
  createdAt: string | null;
  replyToMessageId?: number | null;
  replyToSender?: string | null;
  replyToText?: string | null;
}

export interface ChatSearchResponse {
  results: ChatSearchHit[];
  hasMore: boolean;
  page: number;
}

@Injectable({ providedIn: 'root' })
export class InboxApiService {
  private readonly url = environment.apiUrl + '/api/messages/inbox';

  constructor(private readonly http: HttpClient) {}

  summaries(conversations: InboxReference[]): Observable<InboxSummary[]> {
    return this.http.post<InboxSummary[]>(this.url + '/summaries', { conversations });
  }

  /** Search persisted messages (not just the 30 messages in the open UI). */
  searchMessages(conversation: InboxReference, query: string, page = 0): Observable<ChatSearchResponse> {
    return this.http.get<ChatSearchResponse>(this.url + '/search', {
      params: { kind: conversation.kind, id: conversation.id, q: query, page }
    });
  }

  markRead(conversation: InboxReference, lastSeenMessageId: number): Observable<InboxSummary> {
    return this.http.put<InboxSummary>(this.url + '/read', {
      kind: conversation.kind, id: conversation.id, lastSeenMessageId
    });
  }
}
