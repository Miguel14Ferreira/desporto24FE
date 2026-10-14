import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { environment } from 'src/environment/environment';
import { VenueService } from './venue.service';

describe('VenueService search HTTP contract', () => {
  let service: VenueService;
  let http: HttpTestingController;
  const url = environment.apiUrl + '/api/venues';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [VenueService, provideHttpClient(), provideHttpClientTesting()]
    });
    service = TestBed.inject(VenueService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('preserves existing city and sport query parameters', () => {
    service.search(' Lisboa ', ' Padel ').subscribe();
    const request = http.expectOne(req => req.url === url);
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('city')).toBe('Lisboa');
    expect(request.request.params.get('sport')).toBe('Padel');
    expect(request.request.params.has('latitude')).toBeFalse();
    expect(request.request.params.has('radiusKm')).toBeFalse();
    request.flush([]);
  });

  it('serializes the coordinates and radius for nearby venue search', () => {
    service.search(undefined, 'Padel', 38.72, -9.14, 25).subscribe();
    const request = http.expectOne(req => req.url === url);
    expect(request.request.method).toBe('GET');
    expect(request.request.params.has('city')).toBeFalse();
    expect(request.request.params.get('sport')).toBe('Padel');
    expect(request.request.params.get('latitude')).toBe('38.72');
    expect(request.request.params.get('longitude')).toBe('-9.14');
    expect(request.request.params.get('radiusKm')).toBe('25');
    request.flush([]);
  });
});
