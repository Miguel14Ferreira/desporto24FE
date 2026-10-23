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

@Injectable({ providedIn: 'root' })
export class InboxApiService {
  private readonly url = environment.apiUrl + '/api/messages/inbox';

  constructor(private readonly http: HttpClient) {}

  summaries(conversations: InboxReference[]): Observable<InboxSummary[]> {
    return this.http.post<InboxSummary[]>(this.url + '/summaries', { conversations });
  }

  markRead(conversation: InboxReference, lastSeenMessageId: number): Observable<InboxSummary> {
    return this.http.put<InboxSummary>(this.url + '/read', {
      kind: conversation.kind, id: conversation.id, lastSeenMessageId
    });
  }
}
