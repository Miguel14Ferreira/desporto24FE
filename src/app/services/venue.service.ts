import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from 'src/environment/environment';
import { CreateVenueRequest, Venue } from '../pages/model/venue';

@Injectable({
  providedIn: 'root'
})
export class VenueService {
  private readonly baseUrl = environment.apiUrl + '/api/venues';

  constructor(private http: HttpClient) {}

  search(city?: string, sport?: string): Observable<Venue[]> {
    let params = new HttpParams();

    if (city?.trim()) {
      params = params.set('city', city.trim());
    }
    if (sport?.trim()) {
      params = params.set('sport', sport.trim());
    }

    return this.http.get<Venue[]>(this.baseUrl, { params });
  }

  get(id: number): Observable<Venue> {
    return this.http.get<Venue>(this.baseUrl + '/' + id);
  }

  create(request: CreateVenueRequest): Observable<Venue> {
    return this.http.post<Venue>(this.baseUrl, request);
  }
}
