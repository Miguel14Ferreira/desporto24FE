import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from 'src/environment/environment';

@Injectable({
  providedIn: 'root'
})
export class AdminAccessService {
  constructor(private http: HttpClient) {}

  check(): Observable<void> {
    return this.http.get<void>(`${environment.apiUrl}/api/admin/access`);
  }
}
