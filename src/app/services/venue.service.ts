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

export interface NearbyCityVenuePage {
  referenceCity: string;
  radiusKm: number;
  referenceAvailable: boolean;
  venues: { venue: Venue; distanceKm: number }[];
  page: number;
  hasMore: boolean;
}

/** No public count or average is exposed until three different people rate. */
export interface VenueRatingSummary {
  venueId: number;
  ratingCount: number;
  averageScore: number | null;
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

/** Optional reverse lookup; GPS coordinates remain authoritative for the map. */
export interface ReverseVenueLocation {
  city: string | null;
  address: string | null;
  distanceMeters: number | null;
  provider: string;
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
  suggest(name?: string, city?: string, sport?: string, page = 0, district?: string): Observable<VenueSuggestionPage> {
    let params = new HttpParams().set('page', String(page));
    if (name?.trim()) params = params.set('name', name.trim());
    if (city?.trim()) params = params.set('city', city.trim());
    if (sport?.trim()) params = params.set('sport', sport.trim());
    if (district?.trim()) params = params.set('district', district.trim());
    return this.http.get<VenueSuggestionPage>(this.baseUrl + '/suggest', { params });
  }

  /** Distances from approximate saved venue-GPS reference, not official city centre. */
  nearbyCity(city: string, sport?: string, page = 0, radiusKm = 25): Observable<NearbyCityVenuePage> {
    let params = new HttpParams().set('city', city.trim()).set('page', String(page))
      .set('radiusKm', String(radiusKm));
    if (sport?.trim()) params = params.set('sport', sport.trim());
    return this.http.get<NearbyCityVenuePage>(this.baseUrl + '/nearby-city', { params });
  }

  getRatingSummary(id: number): Observable<VenueRatingSummary> {
    return this.http.get<VenueRatingSummary>(this.baseUrl + '/' + id + '/ratings/summary');
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

  reverseLocation(latitude: number, longitude: number, accuracyMeters?: number): Observable<ReverseVenueLocation> {
    let params = new HttpParams()
      .set('latitude', String(latitude))
      .set('longitude', String(longitude));
    if (accuracyMeters !== undefined && Number.isFinite(accuracyMeters)) {
      params = params.set('accuracyMeters', String(accuracyMeters));
    }
    return this.http.get<ReverseVenueLocation>(this.baseUrl + '/reverse-location', { params });
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

  /** Submissions are not venues until reviewed and approved by an admin. */
  submitSuggestion(request: CreateVenueRequest): Observable<{ id: number; status: string }> {
    return this.http.post<{ id: number; status: string }>(this.baseUrl, request);
  }
}
