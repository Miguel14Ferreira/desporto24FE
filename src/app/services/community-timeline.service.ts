import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environment/environment';

export type CommunityTimelineKind = 'POST' | 'CHAT';

export interface CommunityTimelineEntry {
  id: number;
  communityId: number;
  kind: CommunityTimelineKind;
  username: string;
  body: string;
  createdAt: string;
  replyToMessageId?: number | null;
  replyToSender?: string | null;
  replyToText?: string | null;
}

@Injectable({ providedIn: 'root' })
export class CommunityTimelineService {
  private readonly api = environment.apiUrl + '/api/communities';
  constructor(private readonly http: HttpClient) {}

  private url(id: number, kind: CommunityTimelineKind): string {
    return this.api + '/' + id + (kind === 'POST' ? '/posts' : '/messages');
  }

  list(id: number, kind: CommunityTimelineKind): Observable<CommunityTimelineEntry[]> {
    return this.http.get<CommunityTimelineEntry[]>(this.url(id, kind));
  }

  olderMessages(id: number, beforeId: number): Observable<CommunityTimelineEntry[]> {
    return this.http.get<CommunityTimelineEntry[]>(
      this.url(id, 'CHAT') + '/older', { params: { before: String(beforeId) } });
  }

  send(id: number, kind: CommunityTimelineKind, body: string,
       replyToMessageId?: number): Observable<CommunityTimelineEntry> {
    return this.http.post<CommunityTimelineEntry>(this.url(id, kind),
      { body: body.trim(), ...(kind === 'CHAT' && replyToMessageId ? { replyToMessageId } : {}) });
  }

  delete(id: number, kind: CommunityTimelineKind, entryId: number): Observable<void> {
    return this.http.delete<void>(this.url(id, kind) + '/' + entryId);
  }
}
