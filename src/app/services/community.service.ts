import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from 'src/environment/environment';
import { CommunityProfile } from '../pages/model/community-profile';
import { FriendSummary } from '../pages/model/friend-summary';

@Injectable({
  providedIn: 'root'
})
export class CommunityService {
  private readonly profileUrl = environment.apiUrl + '/api/profile';
  private readonly friendsUrl = environment.apiUrl + '/api/friends';

  constructor(private http: HttpClient) {}

  searchProfiles(name: string): Observable<CommunityProfile[]> {
    return this.http.get<CommunityProfile[]>(
      this.profileUrl + '/name/' + encodeURIComponent(name.trim())
    );
  }

  sendFriendRequest(username: string): Observable<unknown> {
    return this.http.post(
      this.friendsUrl + '/add/' + encodeURIComponent(username),
      null
    );
  }

  friends(): Observable<FriendSummary[]> {
    return this.http.get<FriendSummary[]>(this.friendsUrl + '/me');
  }
}
