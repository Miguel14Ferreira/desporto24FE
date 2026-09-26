import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from 'src/environment/environment';
import { CustomHttpResponse } from '../pages/custom-http-response';

export interface FeedbackRequest {
  name: string;
  city: string;
  email: string;
  gender: string;
  subject: string;
  problem: string;
}

@Injectable({
  providedIn: 'root'
})
export class FeedbackService {
  private readonly url = environment.apiUrl + '/api/ideas/submit';

  constructor(private http: HttpClient) {}

  submit(request: FeedbackRequest): Observable<CustomHttpResponse> {
    return this.http.post<CustomHttpResponse>(this.url, request);
  }
}
