import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from 'src/environment/environment';
import { ReliabilitySummary } from '../pages/model/reliability-summary';
import { AttendanceHistoryItem } from '../pages/model/attendance-history';

@Injectable({
  providedIn: 'root'
})
export class ReliabilityService {
  private readonly profilesUrl = environment.apiUrl + '/api/profiles';
  private readonly sessionsUrl = environment.apiUrl + '/api/sessions';

  constructor(private http: HttpClient) {}

  summary(username: string): Observable<ReliabilitySummary> {
    return this.http.get<ReliabilitySummary>(
      this.profilesUrl + '/' + encodeURIComponent(username) + '/reliability'
    );
  }

  recordAttendance(
    sessionId: number,
    participantId: number,
    status: 'ATTENDED' | 'NO_SHOW'
  ): Observable<void> {
    return this.http.put<void>(
      this.sessionsUrl + '/' + sessionId + '/participants/' + participantId + '/attendance',
      { status }
    );
  }

  attendanceHistory(): Observable<AttendanceHistoryItem[]> {
    return this.http.get<AttendanceHistoryItem[]>(
      environment.apiUrl + '/api/attendance/me'
    );
  }

  createDispute(participantId: number, reason: string): Observable<void> {
    return this.http.post<void>(
      environment.apiUrl + '/api/attendance-disputes',
      {
        participantId,
        reason: reason.trim()
      }
    );
  }
}
