import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from 'src/environment/environment';
import { DirectChatInfo, DirectChatMessage } from '../pages/model/direct-chat';

@Injectable({
  providedIn: 'root'
})
export class DirectChatService {
  private readonly baseUrl = environment.apiUrl + '/api/chat/me';

  constructor(private http: HttpClient) {}

  history(username: string): Observable<DirectChatMessage[]> {
    return this.http.get<DirectChatMessage[]>(
      this.baseUrl + '/' + encodeURIComponent(username)
    );
  }

  recentHistory(username: string): Observable<{ content: DirectChatMessage[] }> {
    return this.http.get<{ content: DirectChatMessage[] }>(
      this.baseUrl + '/' + encodeURIComponent(username) + '/page?page=0&size=30'
    );
  }

  send(username: string, text: string): Observable<DirectChatMessage> {
    return this.http.post<DirectChatMessage>(
      this.baseUrl + '/' + encodeURIComponent(username),
      { text: text.trim() }
    );
  }

  info(username: string): Observable<DirectChatInfo> {
    return this.http.get<DirectChatInfo>(
      this.baseUrl + '/' + encodeURIComponent(username) + '/info'
    );
  }
}
