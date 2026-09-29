import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from 'src/environment/environment';
import {
  CreateVenueRequest,
  Venue,
  VenueInformationSource
} from '../pages/model/venue';

export interface VenuePhoto {
  id: number;
  photoUrl: string;
  uploadedByUsername: string | null;
  createdAt: string;
}

export interface VenueSportCondition {
  id: number;
  sport: string;
  conditions: string;
  informationSource: VenueInformationSource;
  createdByUsername: string | null;
  createdAt: string;
}

export interface CreateVenueSportConditionRequest {
  sport: string;
  conditions: string;
}

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

  listPhotos(id: number): Observable<VenuePhoto[]> {
    return this.http.get<VenuePhoto[]>(this.baseUrl + '/' + id + '/photos');
  }

  addPhoto(id: number, file: File): Observable<VenuePhoto> {
    const formData = new FormData();
    formData.append('photo', file);

    return this.http.post<VenuePhoto>(
      this.baseUrl + '/' + id + '/photos',
      formData
    );
  }

  listSportConditions(id: number): Observable<VenueSportCondition[]> {
    return this.http.get<VenueSportCondition[]>(
      this.baseUrl + '/' + id + '/sport-conditions'
    );
  }

  addSportCondition(
    id: number,
    request: CreateVenueSportConditionRequest
  ): Observable<VenueSportCondition> {
    return this.http.post<VenueSportCondition>(
      this.baseUrl + '/' + id + '/sport-conditions',
      request
    );
  }

  create(request: CreateVenueRequest): Observable<Venue> {
    return this.http.post<Venue>(this.baseUrl, request);
  }
}
