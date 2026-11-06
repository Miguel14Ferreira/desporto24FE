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

export interface CommunityWarningAppeal {
  id: number;
  warningId: number;
  communityId: number;
  authorProfileId: number;
  statement: string;
  createdAt: string;
}

export interface CommunityWarningAppealDecision {
  id: number;
  appealId: number;
  communityId: number;
  reviewedByProfileId: number;
  outcome: 'UPHELD' | 'OVERTURNED';
  reason: string;
  decidedAt: string;
}

export interface CommunityTournamentSuspension {
  id: number;
  communityId: number;
  targetProfileId: number;
  issuedByProfileId: number;
  reason: string;
  startsAt: string;
  endsAt: string;
  revokedAt: string | null;
  revokedByProfileId: number | null;
  revocationReason: string | null;
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
  myAppeals(communityId: number): Observable<CommunityWarningAppeal[]> {
    return this.http.get<CommunityWarningAppeal[]>(
      `${this.base}/${communityId}/discipline/appeals/me`);
  }

  listAppeals(communityId: number): Observable<CommunityWarningAppeal[]> {
    return this.http.get<CommunityWarningAppeal[]>(
      `${this.base}/${communityId}/discipline/appeals`);
  }

  appeal(communityId: number, warningId: number, statement: string): Observable<CommunityWarningAppeal> {
    return this.http.post<CommunityWarningAppeal>(
      `${this.base}/${communityId}/discipline/warnings/${warningId}/appeal`,
      { statement });
  }

  myDecisions(communityId: number): Observable<CommunityWarningAppealDecision[]> {
    return this.http.get<CommunityWarningAppealDecision[]>(
      `${this.base}/${communityId}/discipline/appeals/decisions/me`);
  }

  listDecisions(communityId: number): Observable<CommunityWarningAppealDecision[]> {
    return this.http.get<CommunityWarningAppealDecision[]>(
      `${this.base}/${communityId}/discipline/appeals/decisions`);
  }

  decide(communityId: number, appealId: number,
         outcome: CommunityWarningAppealDecision['outcome'], reason: string):
      Observable<CommunityWarningAppealDecision> {
    return this.http.post<CommunityWarningAppealDecision>(
      `${this.base}/${communityId}/discipline/appeals/${appealId}/decision`,
      { outcome, reason });
  }
  tournamentSuspensions(communityId: number): Observable<CommunityTournamentSuspension[]> {
    return this.http.get<CommunityTournamentSuspension[]>(
      `${this.base}/${communityId}/discipline/tournament-suspensions`);
  }

  myTournamentSuspensions(communityId: number): Observable<CommunityTournamentSuspension[]> {
    return this.http.get<CommunityTournamentSuspension[]>(
      `${this.base}/${communityId}/discipline/tournament-suspensions/me`);
  }

  issueTournamentSuspension(communityId: number, targetProfileId: number,
                            days: number, reason: string): Observable<CommunityTournamentSuspension> {
    return this.http.post<CommunityTournamentSuspension>(
      `${this.base}/${communityId}/discipline/tournament-suspensions`,
      { targetProfileId, days, reason });
  }

  liftTournamentSuspension(communityId: number, suspensionId: number,
                           reason: string): Observable<CommunityTournamentSuspension> {
    return this.http.post<CommunityTournamentSuspension>(
      `${this.base}/${communityId}/discipline/tournament-suspensions/${suspensionId}/lift`,
      { reason });
  }

}
