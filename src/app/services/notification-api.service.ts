import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, Subject, tap } from 'rxjs';

import { environment } from 'src/environment/environment';
import { AppNotification } from '../pages/model/app-notification';

export interface NotificationPreferences {
  inAppEnabled: boolean;
  emailEnabled: boolean;
  disabledInAppTypes: string[];
  disabledEmailTypes: string[];
}

@Injectable({
  providedIn: 'root'
})
export class NotificationApiService {
  private readonly baseUrl = environment.apiUrl + '/api/notifications';
  private readonly changedSubject = new Subject<void>();
  /** Emitted only after a notification mutation is confirmed by the API. */
  readonly changes$ = this.changedSubject.asObservable();

  constructor(private http: HttpClient) {}

  preferences(): Observable<NotificationPreferences> {
    return this.http.get<NotificationPreferences>(this.baseUrl + '/me/preferences');
  }

  updatePreferences(settings: NotificationPreferences): Observable<NotificationPreferences> {
    return this.http.put<NotificationPreferences>(
      this.baseUrl + '/me/preferences', settings
    ).pipe(tap(() => this.changedSubject.next()));
  }

  mine(): Observable<AppNotification[]> {
    return this.http.get<AppNotification[]>(this.baseUrl + '/me');
  }

  unreadCount(): Observable<number> {
    return this.http.get<number>(this.baseUrl + '/me/unread-count');
  }

  blockOwnAccount(): Observable<void> {
    return this.http.post<void>(
      this.baseUrl + '/me/block',
      null,
      { withCredentials: true }
    );
  }

  deleteAll(): Observable<void> {
    return this.http.delete<void>(this.baseUrl + '/me')
      .pipe(tap(() => this.changedSubject.next()));
  }

  markRead(id: number): Observable<void> {
    return this.http.put<void>(this.baseUrl + '/' + id + '/read', null)
      .pipe(tap(() => this.changedSubject.next()));
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(this.baseUrl + '/' + id)
      .pipe(tap(() => this.changedSubject.next()));
  }

  acceptFriendRequest(id: number): Observable<unknown> {
    return this.http.post(
      this.baseUrl + '/friend-request/' + id + '/accept',
      null
    ).pipe(tap(() => this.changedSubject.next()));
  }

  rejectFriendRequest(id: number): Observable<void> {
    return this.http.delete<void>(
      this.baseUrl + '/friend-request/' + id + '/reject'
    ).pipe(tap(() => this.changedSubject.next()));
  }
}
