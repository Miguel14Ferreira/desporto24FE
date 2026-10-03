import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environment/environment';

export interface AdminPlayer {
  id: number;
  username: string;
  fullName: string | null;
  nickname: string | null;
  role: string | null;
  enabled: boolean | null;
  notLocked: boolean | null;
}
export interface AdminPlayerSearch {
  players: AdminPlayer[];
  page: number;
  hasMore: boolean;
}

@Injectable({ providedIn: 'root' })
export class AdminPlayersService {
  constructor(private http: HttpClient) {}
  changeRole(id: number, role: string, expectedRole: string): Observable<{ id: number; role: string }> {
    return this.http.put<{ id: number; role: string }>(
      environment.apiUrl + '/api/admin/players/' + id + '/role', { role, expectedRole });
  }

  search(name: string, page: number): Observable<AdminPlayerSearch> {
    const params = new HttpParams().set('name', name.trim()).set('page', String(page));
    return this.http.get<AdminPlayerSearch>(environment.apiUrl + '/api/admin/players', { params });
  }
}
