import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environment/environment';

export interface CommunityDisciplinaryWarning {
  id: number;
  communityId: number;
  targetProfileId: number;
  issuedByProfileId: number;
  reason: string;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class CommunityDisciplineService {
  private readonly base = environment.apiUrl + '/api/communities';
  constructor(private readonly http: HttpClient) {}

  mine(communityId: number): Observable<CommunityDisciplinaryWarning[]> {
    return this.http.get<CommunityDisciplinaryWarning[]>(
      `${this.base}/${communityId}/discipline/warnings/me`);
  }

  list(communityId: number): Observable<CommunityDisciplinaryWarning[]> {
    return this.http.get<CommunityDisciplinaryWarning[]>(
      `${this.base}/${communityId}/discipline/warnings`);
  }

  warn(communityId: number, targetProfileId: number, reason: string):
      Observable<CommunityDisciplinaryWarning> {
    return this.http.post<CommunityDisciplinaryWarning>(
      `${this.base}/${communityId}/discipline/warnings`,
      { targetProfileId, reason });
  }
}
