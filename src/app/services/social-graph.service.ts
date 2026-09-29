import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from 'src/environment/environment';
import { FollowProfile, FollowStatus } from '../pages/model/follow';

@Injectable({
  providedIn: 'root'
})
export class SocialGraphService {
  private readonly baseUrl = environment.apiUrl + '/api/follows';

  constructor(private http: HttpClient) {}

  follow(username: string): Observable<FollowStatus> {
    return this.http.post<FollowStatus>(
      this.baseUrl + '/' + encodeURIComponent(username),
      null
    );
  }

  unfollow(username: string): Observable<FollowStatus> {
    return this.http.delete<FollowStatus>(
      this.baseUrl + '/' + encodeURIComponent(username)
    );
  }

  status(username: string): Observable<FollowStatus> {
    return this.http.get<FollowStatus>(
      this.baseUrl + '/' + encodeURIComponent(username) + '/status'
    );
  }

  followers(username: string): Observable<FollowProfile[]> {
    return this.http.get<FollowProfile[]>(
      this.baseUrl + '/' + encodeURIComponent(username) + '/followers'
    );
  }

  following(username: string): Observable<FollowProfile[]> {
    return this.http.get<FollowProfile[]>(
      this.baseUrl + '/' + encodeURIComponent(username) + '/following'
    );
  }
}
