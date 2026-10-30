import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environment/environment';
import { SessionPreset, SessionPresetSettings } from '../pages/model/session-preset';

@Injectable({providedIn: 'root'})
export class SessionPresetService {
  private readonly url = environment.apiUrl + '/api/sessions/presets';
  constructor(private http: HttpClient) {}

  mine(): Observable<SessionPreset[]> {
    return this.http.get<SessionPreset[]>(this.url);
  }

  create(name: string, settings: SessionPresetSettings): Observable<SessionPreset> {
    return this.http.post<SessionPreset>(this.url, { name, settings });
  }

  update(id: number, name: string, settings: SessionPresetSettings): Observable<SessionPreset> {
    return this.http.put<SessionPreset>(this.url + '/' + id, { name, settings });
  }

  remove(id: number): Observable<void> {
    return this.http.delete<void>(this.url + '/' + id);
  }
}
