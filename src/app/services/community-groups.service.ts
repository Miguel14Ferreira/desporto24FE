import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from 'src/environment/environment';
import {
  CommunityCompetitionOverview,
  CommunityCompetitionSettings,
  CommunityGroup,
  CommunityInvite,
  CommunityMatchResult,
  CommunityRole,
  CommunityVisibility
} from '../pages/model/community-group';

@Injectable({ providedIn: 'root' })
export class CommunityGroupsService {
  private readonly url = environment.apiUrl + '/api/communities';

  constructor(private http: HttpClient) {}

  mine(): Observable<CommunityGroup[]> {
    return this.http.get<CommunityGroup[]>(this.url + '/mine');
  }

  get(id: number): Observable<CommunityGroup> {
    return this.http.get<CommunityGroup>(this.url + '/' + id);
  }

  create(request: {
    name: string;
    description: string | null;
    sport: string | null;
    visibility: CommunityVisibility;
  }): Observable<CommunityGroup> {
    return this.http.post<CommunityGroup>(this.url, request);
  }

  competition(id: number): Observable<CommunityCompetitionOverview> {
    return this.http.get<CommunityCompetitionOverview>(
      this.url + '/' + id + '/competition'
    );
  }

  updateCompetitionSettings(
    id: number,
    request: {
      rankingsEnabled: boolean;
      winPoints: number;
      drawPoints: number;
      lossPoints: number;
    }
  ): Observable<CommunityCompetitionSettings> {
    return this.http.put<CommunityCompetitionSettings>(
      this.url + '/' + id + '/competition/settings',
      request
    );
  }

  createRound(
    id: number,
    request: {
      name: string;
      playedAt: string;
      entries: Array<{
        username: string;
        result: CommunityMatchResult;
        goals: number;
        assists: number;
        mvp: boolean;
        cleanSheet: boolean;
      }>;
    }
  ): Observable<unknown> {
    return this.http.post(
      this.url + '/' + id + '/rounds',
      request
    );
  }

  deleteRound(communityId: number, roundId: number): Observable<void> {
    return this.http.delete<void>(
      this.url + '/' + communityId + '/rounds/' + roundId
    );
  }

  updatePhoto(id: number, photo: File): Observable<CommunityGroup> {
    const formData = new FormData();
    formData.append('photo', photo);
    return this.http.put<CommunityGroup>(this.url + '/' + id + '/photo', formData);
  }

  myInvites(): Observable<CommunityInvite[]> {
    return this.http.get<CommunityInvite[]>(this.url + '/invites/me');
  }

  invite(id: number, username: string): Observable<CommunityInvite> {
    return this.http.post<CommunityInvite>(
      this.url + '/' + id + '/invites',
      { username }
    );
  }

  acceptInvite(inviteId: number): Observable<CommunityGroup> {
    return this.http.post<CommunityGroup>(
      this.url + '/invites/' + inviteId + '/accept',
      null
    );
  }

  rejectInvite(inviteId: number): Observable<void> {
    return this.http.post<void>(
      this.url + '/invites/' + inviteId + '/reject',
      null
    );
  }

  updateRole(
    communityId: number,
    username: string,
    role: Exclude<CommunityRole, 'OWNER'>
  ): Observable<CommunityGroup> {
    return this.http.put<CommunityGroup>(
      this.url + '/' + communityId + '/members/' + encodeURIComponent(username) + '/role',
      { role }
    );
  }

  removeMember(communityId: number, username: string): Observable<void> {
    return this.http.delete<void>(
      this.url + '/' + communityId + '/members/' + encodeURIComponent(username)
    );
  }

  leave(communityId: number): Observable<void> {
    return this.http.post<void>(
      this.url + '/' + communityId + '/leave',
      null
    );
  }

  transferOwnership(communityId: number, username: string): Observable<CommunityGroup> {
    return this.http.put<CommunityGroup>(
      this.url + '/' + communityId + '/owner',
      { username }
    );
  }
}
