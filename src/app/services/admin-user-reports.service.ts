import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from 'src/environment/environment';
import {
  AdminUserReport,
  ClosedUserReportStatus
} from '../pages/model/admin-user-report';

@Injectable({ providedIn: 'root' })
export class AdminUserReportsService {
  private readonly url = environment.apiUrl + '/api/admin/reports/users';

  constructor(private http: HttpClient) {}

  listOpen(): Observable<AdminUserReport[]> {
    return this.http.get<AdminUserReport[]>(this.url);
  }

  updateStatus(
    id: number,
    status: ClosedUserReportStatus
  ): Observable<AdminUserReport> {
    return this.http.put<AdminUserReport>(
      this.url + '/' + id + '/status',
      { status }
    );
  }
}
