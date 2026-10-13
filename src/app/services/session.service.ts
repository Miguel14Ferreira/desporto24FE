import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from 'src/environment/environment';
import { SessionDetail } from '../pages/model/session-detail';
import { SessionSummary } from '../pages/model/session-summary';
import { MySessionsResponse } from '../pages/model/my-sessions-response';
import { SessionMessage } from '../pages/model/session-message';
import { CreateSessionRequest } from '../pages/model/create-session-request';
import { SessionParticipant } from '../pages/model/session-participant';

export interface SessionSearchFilters {
  query?: string;
  sport?: string;
  city?: string;
  availability?: string;
  privateGame?: boolean;
  freeOnly?: boolean;
  sort?: string;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  from?: string;
  to?: string;
  minPrice?: number;
  maxPrice?: number;
}

export interface JoinSessionResponse {
  state: 'PARTICIPANT' | 'WAITLISTED';
  waitlistPosition: number | null;
}

export interface SessionTeamPlayer {
  username: string;
  strengthScore: number;
  statsAvailable: boolean;
  games: number;
  wins: number;
  goals: number;
  assists: number;
}

export interface SessionTeamSuggestion {
  teamA: SessionTeamPlayer[];
  teamB: SessionTeamPlayer[];
  teamAScore: number;
  teamBScore: number;
  playersWithStats: number;
  totalPlayers: number;
}

@Injectable({
  providedIn: 'root'
})
export class SessionService {
  private readonly baseUrl = environment.apiUrl + '/api/sessions';

  constructor(private http: HttpClient) {}

  discover(filters: SessionSearchFilters = {}): Observable<SessionSummary[]> {
    let params = new HttpParams();

    if (filters.query?.trim()) {
      params = params.set('query', filters.query.trim());
    }
    if (filters.sport?.trim()) {
      params = params.set('sport', filters.sport.trim());
    }
    if (filters.city?.trim()) {
      params = params.set('city', filters.city.trim());
    }
    if (filters.availability) {
      params = params.set('availability', filters.availability);
    }
    if (filters.privateGame !== undefined) {
      params = params.set('privateGame', String(filters.privateGame));
    }
    if (filters.freeOnly !== undefined) {
      params = params.set('freeOnly', String(filters.freeOnly));
    }
    if (filters.sort) {
      params = params.set('sort', filters.sort);
    }
    if (filters.latitude !== undefined) {
      params = params.set('latitude', String(filters.latitude));
    }
    if (filters.longitude !== undefined) {
      params = params.set('longitude', String(filters.longitude));
    }
    if (filters.radiusKm !== undefined) {
      params = params.set('radiusKm', String(filters.radiusKm));
    }
    if (filters.from) {
      params = params.set('from', filters.from);
    }
    if (filters.to) {
      params = params.set('to', filters.to);
    }
    if (filters.minPrice !== undefined) {
      params = params.set('minPrice', String(filters.minPrice));
    }
    if (filters.maxPrice !== undefined) {
      params = params.set('maxPrice', String(filters.maxPrice));
    }

    return this.http.get<SessionSummary[]>(this.baseUrl, { params });
  }

  detail(id: number): Observable<SessionDetail> {
    return this.http.get<SessionDetail>(this.baseUrl + '/' + id);
  }

  join(id: number, password?: string): Observable<JoinSessionResponse> {
    return this.http.post<JoinSessionResponse>(
      this.baseUrl + '/' + id + '/join',
      { password: password?.trim() || null }
    );
  }

  leave(id: number): Observable<void> {
    return this.http.post<void>(this.baseUrl + '/' + id + '/leave', null);
  }

  mine(): Observable<MySessionsResponse> {
    return this.http.get<MySessionsResponse>(this.baseUrl + '/mine');
  }

  cancel(id: number): Observable<void> {
    return this.http.post<void>(this.baseUrl + '/' + id + '/cancel', null);
  }

  complete(id: number): Observable<void> {
    return this.http.post<void>(this.baseUrl + '/' + id + '/complete', null);
  }

  reportDidNotOccur(id: number): Observable<void> {
    return this.http.post<void>(
      this.baseUrl + '/' + id + '/problems/not-occurred',
      null
    );
  }

  reportProblem(
    id: number,
    type: 'NOT_OCCURRED' | 'VENUE_PROBLEM' | 'OTHER',
    details?: string
  ): Observable<void> {
    return this.http.post<void>(
      this.baseUrl + '/' + id + '/problems',
      { type, details: details?.trim() || null }
    );
  }

  messages(id: number): Observable<SessionMessage[]> {
    return this.http.get<SessionMessage[]>(this.baseUrl + '/' + id + '/messages');
  }

  postMessage(id: number, body: string): Observable<SessionMessage> {
    return this.http.post<SessionMessage>(
      this.baseUrl + '/' + id + '/messages',
      { body: body.trim() }
    );
  }

  participants(id: number): Observable<SessionParticipant[]> {
    return this.http.get<SessionParticipant[]>(this.baseUrl + '/' + id + '/participants');
  }

  teamSuggestion(id: number): Observable<SessionTeamSuggestion> {
    return this.http.get<SessionTeamSuggestion>(
      this.baseUrl + '/' + id + '/teams/suggestion'
    );
  }

  confirmTeams(id: number): Observable<SessionTeamSuggestion> {
    return this.http.post<SessionTeamSuggestion>(
      this.baseUrl + '/' + id + '/teams/confirm',
      null
    );
  }

  futureExclusionStatus(id: number, participantId: number): Observable<{ excluded: boolean }> {
    return this.http.get<{ excluded: boolean }>(
      this.baseUrl + '/' + id + '/participants/' + participantId + '/future-exclusion'
    );
  }

  excludeFromFutureSessions(id: number, participantId: number): Observable<{ excluded: boolean }> {
    return this.http.put<{ excluded: boolean }>(
      this.baseUrl + '/' + id + '/participants/' + participantId + '/future-exclusion', null
    );
  }

  allowFutureSessions(id: number, participantId: number): Observable<{ excluded: boolean }> {
    return this.http.delete<{ excluded: boolean }>(
      this.baseUrl + '/' + id + '/participants/' + participantId + '/future-exclusion'
    );
  }

  removeParticipant(id: number, participantId: number): Observable<void> {
    return this.http.delete<void>(
      this.baseUrl + '/' + id + '/participants/' + participantId
    );
  }

  create(request: CreateSessionRequest, photo?: File): Observable<SessionDetail> {
    if (!photo) {
      return this.http.post<SessionDetail>(this.baseUrl, request);
    }

    const formData = new FormData();
    formData.append(
      'session',
      new Blob([JSON.stringify(request)], { type: 'application/json' })
    );
    formData.append('photo', photo);

    return this.http.post<SessionDetail>(this.baseUrl, formData);
  }
}
