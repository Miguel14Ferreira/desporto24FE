import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environment/environment';
import {
  CommunityTournament,
  TournamentMatch,
  TournamentMatchPage,
  TournamentPage,
  TournamentParticipant,
  TournamentParticipantPage,
  TournamentScheduleSummary,
  TournamentStandings
} from '../pages/model/community-tournament';

@Injectable({ providedIn: 'root' })
export class CommunityTournamentsService {
  private readonly baseUrl = environment.apiUrl + '/api/communities';

  constructor(private readonly http: HttpClient) {}

  private url(communityId: number, tournamentId?: number): string {
    const base = this.baseUrl + '/' + communityId + '/tournaments';
    return tournamentId == null ? base : base + '/' + tournamentId;
  }

  list(communityId: number, page: number): Observable<TournamentPage> {
    return this.http.get<TournamentPage>(this.url(communityId), {
      params: new HttpParams().set('page', String(page))
    });
  }

  create(communityId: number, name: string, sport: string): Observable<CommunityTournament> {
    return this.http.post<CommunityTournament>(this.url(communityId), { name, sport });
  }

  delete(communityId: number, tournamentId: number): Observable<void> {
    return this.http.delete<void>(this.url(communityId, tournamentId));
  }

  participants(communityId: number, tournamentId: number, page: number): Observable<TournamentParticipantPage> {
    return this.http.get<TournamentParticipantPage>(this.url(communityId, tournamentId) + '/participants', {
      params: { page: String(page) }
    });
  }

  join(communityId: number, tournamentId: number): Observable<TournamentParticipant> {
    return this.http.put<TournamentParticipant>(this.url(communityId, tournamentId) + '/participants/me', null);
  }

  leave(communityId: number, tournamentId: number): Observable<void> {
    return this.http.delete<void>(this.url(communityId, tournamentId) + '/participants/me');
  }

  confirm(communityId: number, tournamentId: number, profileId: number): Observable<TournamentParticipant> {
    return this.http.put<TournamentParticipant>(
      this.url(communityId, tournamentId) + '/participants/' + profileId + '/confirm', null
    );
  }

  removeParticipant(communityId: number, tournamentId: number, profileId: number): Observable<void> {
    return this.http.delete<void>(
      this.url(communityId, tournamentId) + '/participants/' + profileId
    );
  }

  generateSchedule(communityId: number, tournamentId: number): Observable<TournamentScheduleSummary> {
    return this.http.post<TournamentScheduleSummary>(this.url(communityId, tournamentId) + '/schedule', null);
  }

  matches(communityId: number, tournamentId: number, page: number): Observable<TournamentMatchPage> {
    return this.http.get<TournamentMatchPage>(this.url(communityId, tournamentId) + '/matches', {
      params: { page: String(page) }
    });
  }

  recordResult(communityId: number, tournamentId: number, matchId: number,
               homeScore: number, awayScore: number): Observable<TournamentMatch> {
    return this.http.put<TournamentMatch>(
      this.url(communityId, tournamentId) + '/matches/' + matchId + '/result',
      { homeScore, awayScore }
    );
  }

  standings(communityId: number, tournamentId: number): Observable<TournamentStandings> {
    return this.http.get<TournamentStandings>(this.url(communityId, tournamentId) + '/standings');
  }

  complete(communityId: number, tournamentId: number): Observable<CommunityTournament> {
    return this.http.post<CommunityTournament>(this.url(communityId, tournamentId) + '/complete', null);
  }
}
