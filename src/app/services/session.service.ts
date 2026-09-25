import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from 'src/environment/environment';
import { SessionDetail } from '../pages/model/session-detail';
import { SessionSummary } from '../pages/model/session-summary';

export interface SessionSearchFilters {
  sport?: string;
  city?: string;
  availability?: string;
  privateGame?: boolean;
  freeOnly?: boolean;
  sort?: string;
}

export interface JoinSessionResponse {
  state: 'PARTICIPANT' | 'WAITLISTED';
  waitlistPosition: number | null;
}

@Injectable({
  providedIn: 'root'
})
export class SessionService {
  private readonly baseUrl = environment.apiUrl + '/api/sessions';

  constructor(private http: HttpClient) {}

  discover(filters: SessionSearchFilters = {}): Observable<SessionSummary[]> {
    let params = new HttpParams();

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
}
