import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from 'src/environment/environment';
import { AppNotification } from '../pages/model/app-notification';

@Injectable({
  providedIn: 'root'
})
export class NotificationApiService {
  private readonly baseUrl = environment.apiUrl + '/api/notifications';

  constructor(private http: HttpClient) {}

  mine(): Observable<AppNotification[]> {
    return this.http.get<AppNotification[]>(this.baseUrl + '/me');
  }

  markRead(id: number): Observable<void> {
    return this.http.put<void>(this.baseUrl + '/' + id + '/read', null);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(this.baseUrl + '/' + id);
  }

  acceptFriendRequest(id: number): Observable<unknown> {
    return this.http.post(
      this.baseUrl + '/friend-request/' + id + '/accept',
      null
    );
  }

  rejectFriendRequest(id: number): Observable<void> {
    return this.http.delete<void>(
      this.baseUrl + '/friend-request/' + id + '/reject'
    );
  }
}
