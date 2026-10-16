import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from 'src/environment/environment';
import {
  CreateVenueRequest,
  Venue,
  VenueInformationSource
} from '../pages/model/venue';

export interface VenueSuggestionPage {
  venues: Venue[];
  page: number;
  hasMore: boolean;
}

export interface VenuePhoto {
  id: number;
  photoUrl: string;
  uploadedByUsername: string | null;
  createdAt: string;
}

export interface ResolveVenueMapLinkResponse {
  resolvedUrl: string;
  latitude: number;
  longitude: number;
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

  search(city?: string, sport?: string, latitude?: number, longitude?: number, radiusKm?: number): Observable<Venue[]> {
    let params = new HttpParams();

    if (city?.trim()) {
      params = params.set('city', city.trim());
    }
    if (sport?.trim()) {
      params = params.set('sport', sport.trim());
    }
    if (latitude !== undefined) {
      params = params.set('latitude', String(latitude));
    }
    if (longitude !== undefined) {
      params = params.set('longitude', String(longitude));
    }
    if (radiusKm !== undefined) {
      params = params.set('radiusKm', String(radiusKm));
    }

    return this.http.get<Venue[]>(this.baseUrl, { params });
  }

  /** Bounded server-side autocomplete; keeps the legacy search contract unchanged. */
  suggest(name?: string, city?: string, sport?: string, page = 0): Observable<VenueSuggestionPage> {
    let params = new HttpParams().set('page', String(page));
    if (name?.trim()) params = params.set('name', name.trim());
    if (city?.trim()) params = params.set('city', city.trim());
    if (sport?.trim()) params = params.set('sport', sport.trim());
    return this.http.get<VenueSuggestionPage>(this.baseUrl + '/suggest', { params });
  }

  get(id: number): Observable<Venue> {
    return this.http.get<Venue>(this.baseUrl + '/' + id);
  }

  resolveMapLink(url: string): Observable<ResolveVenueMapLinkResponse> {
    return this.http.post<ResolveVenueMapLinkResponse>(
      this.baseUrl + '/resolve-map-link',
      { url }
    );
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
