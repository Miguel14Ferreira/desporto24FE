import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, map, shareReplay, tap, throwError } from 'rxjs';

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
  // Compatibility bridge until /suggest is deployed. The national catalog
  // must use the paged endpoint: legacy GET /venues fetches a complete list.
  private legacySuggestionsOnly = false;
  private readonly legacyCatalog = new Map<string, Observable<Venue[]>>();

  constructor(private http: HttpClient) {}

  /**
   * Explicit user choice when the old backend accidentally routes /suggest
   * to /{id} and returns 400/500, rather than the expected 404.
   * Never turn an arbitrary server error into an automatic full-catalog fetch.
   */
  enableLegacySuggestions(): void {
    this.legacySuggestionsOnly = true;
  }

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

    return this.http.get<Venue[]>(this.baseUrl, { params }).pipe(
      map(venues => {
        // The currently deployed GET /api/venues accepts only city/sport.
        // It ignores latitude/longitude/radiusKm. Until a scalable spatial
        // endpoint exists, apply the geographic filter before presenting
        // any venue as "Perto de mim" to avoid misleading distance results.
        if (latitude === undefined || longitude === undefined || radiusKm === undefined
            || !Number.isFinite(latitude) || !Number.isFinite(longitude)
            || Math.abs(latitude) > 90 || Math.abs(longitude) > 180
            || !Number.isFinite(radiusKm) || radiusKm <= 0) {
          return venues;
        }

        return venues
          .filter(venue => venue.latitude !== null && venue.longitude !== null
            && Number.isFinite(venue.latitude) && Number.isFinite(venue.longitude)
            && Math.abs(venue.latitude) <= 90 && Math.abs(venue.longitude) <= 180)
          .map(venue => ({
            venue,
            distanceKm: this.distanceKm(
              latitude, longitude, venue.latitude!, venue.longitude!)
          }))
          .filter(item => item.distanceKm <= radiusKm)
          .sort((a, b) => a.distanceKm - b.distanceKm
            || a.venue.name.localeCompare(b.venue.name, 'pt')
            || a.venue.id - b.venue.id)
          .map(item => item.venue);
      })
    );
  }

  /**
   * Prefer bounded server-side results. A 404 means the new /suggest endpoint
   * has not been deployed yet: temporarily fall back to the existing legacy
   * city/sport API. Never fall back for 401/403/5xx responses.
   */
  suggest(name?: string, city?: string, sport?: string, page = 0): Observable<VenueSuggestionPage> {
    if (this.legacySuggestionsOnly) return this.legacySuggest(name, city, sport, page);
    let params = new HttpParams().set('page', String(page));
    if (name?.trim()) params = params.set('name', name.trim());
    if (city?.trim()) params = params.set('city', city.trim());
    if (sport?.trim()) params = params.set('sport', sport.trim());
    return this.http.get<VenueSuggestionPage>(this.baseUrl + '/suggest', { params })
      .pipe(catchError(error => {
        if (error?.status !== 404) return throwError(() => error);
        this.legacySuggestionsOnly = true;
        return this.legacySuggest(name, city, sport, page);
      }));
  }

  private legacySuggest(name?: string, city?: string, sport?: string, page = 0): Observable<VenueSuggestionPage> {
    const key = [this.normalizeVenueText(city), this.normalizeVenueText(sport)].join('|');
    let catalog = this.legacyCatalog.get(key);
    if (!catalog) {
      catalog = this.search(city, sport).pipe(
        catchError(error => {
          this.legacyCatalog.delete(key); // a failed fallback can be retried
          return throwError(() => error);
        }),
        shareReplay({ bufferSize: 1, refCount: false })
      );
      this.legacyCatalog.set(key, catalog);
    }
    return catalog.pipe(map(venues => {
      const query = this.normalizeVenueText(name);
      const filtered = query ? venues.filter(venue => {
        const acronym = venue.name.split(/\s+/).filter(word => word.length > 2)
          .map(word => word[0]).join('');
        return this.normalizeVenueText([
          venue.name, venue.city, venue.address, venue.venueType || '', acronym
        ].join(' ')).includes(query);
      }) : venues;
      const sorted = [...filtered].sort((a, b) =>
        a.name.localeCompare(b.name, 'pt') || a.city.localeCompare(b.city, 'pt') || a.id - b.id
      );
      const offset = Math.max(0, page) * 40;
      return {
        venues: sorted.slice(offset, offset + 40),
        page,
        hasMore: sorted.length > offset + 40
      };
    }));
  }

  private distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const radians = Math.PI / 180;
    const deltaLat = (lat2 - lat1) * radians;
    const deltaLon = (lon2 - lon1) * radians;
    const a = Math.sin(deltaLat / 2) ** 2
      + Math.cos(lat1 * radians) * Math.cos(lat2 * radians)
      * Math.sin(deltaLon / 2) ** 2;
    return 2 * 6371.0088 * Math.asin(Math.min(1, Math.sqrt(a)));
  }

  private normalizeVenueText(value?: string): string {
    return (value || '').normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('pt').trim();
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
    return this.http.post<Venue>(this.baseUrl, request).pipe(
      tap(() => this.legacyCatalog.clear())
    );
  }
}
