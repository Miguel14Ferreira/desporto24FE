import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from 'src/environment/environment';
import { SessionSummary } from '../pages/model/session-summary';
import {
  CommunityCompetitionOverview,
  CommunityCompetitionSettings,
  CommunityGroup,
  CommunityInvite,
  CommunityMatchResult,
  CommunityRole,
  CommunitySeason,
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

  sessions(id: number): Observable<SessionSummary[]> {
    return this.http.get<SessionSummary[]>(
      this.url + '/' + id + '/sessions'
    );
  }

  openSessionToPublic(id: number, sessionId: number): Observable<SessionSummary> {
    return this.http.post<SessionSummary>(
      this.url + '/' + id + '/sessions/' + sessionId + '/open-public',
      null
    );
  }

  competition(
    id: number,
    seasonId: number | null = null
  ): Observable<CommunityCompetitionOverview> {
    const suffix = seasonId === null ? '' : '?seasonId=' + seasonId;
    return this.http.get<CommunityCompetitionOverview>(
      this.url + '/' + id + '/competition' + suffix
    );
  }

  importPreview(id: number, file: File): Observable<{
    fileName: string;
    sheets: Array<{
      name: string;
      nonEmptyRows: number;
      structure: string;
      headers: string[];
      sampleRows: string[][];
      columnSuggestions: Array<{
        columnIndex: number;
        header: string;
        field: string;
        confidence: number;
      }>;
    }>;
  }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<any>(
      this.url + '/' + id + '/competition/import/preview',
      formData
    );
  }

  validateImport(id: number, file: File, mapping: unknown): Observable<any> {
    const formData = this.importForm(file, mapping);
    return this.http.post<any>(this.url + '/' + id + '/competition/import/validate', formData);
  }

  normalizedImportPreview(id: number, file: File, mapping: unknown): Observable<any> {
    const formData = this.importForm(file, mapping);
    return this.http.post<any>(this.url + '/' + id + '/competition/import/normalized-preview', formData);
  }

  confirmImportRounds(id: number, file: File, mapping: unknown, context: unknown): Observable<any> {
    const formData = this.importForm(file, mapping);
    formData.append('context', new Blob([JSON.stringify(context)], { type: 'application/json' }));
    return this.http.post<any>(this.url + '/' + id + '/competition/import/rounds/confirm', formData);
  }

  finalImportPlan(id: number, file: File, mapping: unknown, context: unknown): Observable<any> {
    const formData = this.importForm(file, mapping);
    formData.append('context', new Blob([JSON.stringify(context)], { type: 'application/json' }));
    return this.http.post<any>(this.url + '/' + id + '/competition/import/rounds/final-plan', formData);
  }

  private importForm(file: File, mapping: unknown): FormData {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('mapping', new Blob([JSON.stringify(mapping)], { type: 'application/json' }));
    return formData;
  }

  createSeason(
    id: number,
    request: { name: string; startsAt: string | null }
  ): Observable<CommunitySeason> {
    return this.http.post<CommunitySeason>(
      this.url + '/' + id + '/seasons',
      request
    );
  }

  closeSeason(id: number, seasonId: number): Observable<CommunitySeason> {
    return this.http.post<CommunitySeason>(
      this.url + '/' + id + '/seasons/' + seasonId + '/close',
      null
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
        team: string | null;
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

  removePhoto(id: number): Observable<CommunityGroup> {
    return this.http.delete<CommunityGroup>(this.url + '/' + id + '/photo');
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
