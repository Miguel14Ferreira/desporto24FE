import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from 'src/environment/environment';
import { ReliabilitySummary } from '../pages/model/reliability-summary';

@Injectable({
  providedIn: 'root'
})
export class ReliabilityService {
  private readonly baseUrl = environment.apiUrl + '/api/profiles';

  constructor(private http: HttpClient) {}

  summary(username: string): Observable<ReliabilitySummary> {
    return this.http.get<ReliabilitySummary>(
      this.baseUrl + '/' + encodeURIComponent(username) + '/reliability'
    );
  }
}
