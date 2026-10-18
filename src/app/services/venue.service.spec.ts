import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
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

  it('requests only a bounded venue suggestion page with validated filters', () => {
    service.suggest('  Pavilhão ', ' Porto ', ' Futsal ', 2).subscribe(result => {
      expect(result.page).toBe(2);
    });
    const req = http.expectOne(request => request.url === url + '/suggest');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('name')).toBe('Pavilhão');
    expect(req.request.params.get('city')).toBe('Porto');
    expect(req.request.params.get('sport')).toBe('Futsal');
    expect(req.request.params.get('page')).toBe('2');
    req.flush({ venues: [], page: 2, hasMore: false });
  });

  it('keeps optional filters empty on an initial suggestion page', () => {
    service.suggest('', '   ').subscribe();
    const req = http.expectOne(request => request.url === url + '/suggest');
    expect(req.request.params.keys()).toEqual(['page']);
    req.flush({ venues: [], page: 0, hasMore: false });
  });

  it('falls back only on 404 and pages the existing catalog without repeating its HTTP request', () => {
    const found: any[] = Array.from({ length: 85 }, (_, i) => ({
      id: i + 1, name: 'Pavilhão', city: 'Porto', address: 'Rua ' + (i + 1), sports: 'Padel'
    }));
    let first: number[] = [];
    let second: number[] = [];
    service.suggest('Pavilhão', 'Porto', 'Padel', 0).subscribe(result => {
      first = result.venues.map(venue => venue.id);
      expect(result.hasMore).toBeTrue();
      expect(result.page).toBe(0);
    });
    const missing = http.expectOne(req => req.url === url + '/suggest');
    missing.flush({ message: 'Not Found' }, { status: 404, statusText: 'Not Found' });
    const legacy = http.expectOne(req => req.url === url);
    expect(legacy.request.params.get('city')).toBe('Porto');
    expect(legacy.request.params.get('sport')).toBe('Padel');
    legacy.flush(found);
    expect(first).toHaveSize(40);
    service.suggest('Pavilhão', 'Porto', 'Padel', 1).subscribe(result => {
      second = result.venues.map(venue => venue.id);
      expect(result.hasMore).toBeTrue();
      expect(result.page).toBe(1);
    });
    expect(second).toHaveSize(40);
    expect(first.some(id => second.includes(id))).toBeFalse();
    http.expectNone(req => req.url === url || req.url === url + '/suggest');
  });

  it('matches accent-free names and acronyms when the old API is used', () => {
    let names: string[] = [];
    service.suggest('pavilhao', 'Porto', 'Padel').subscribe(result => {
      names = result.venues.map(v => v.name);
    });
    http.expectOne(req => req.url === url + '/suggest')
      .flush({}, { status: 404, statusText: 'Not Found' });
    http.expectOne(req => req.url === url).flush([
      { id: 1, name: 'Pavilhão Municipal', city: 'Porto', address: 'Rua 1', sports: 'Padel' },
      { id: 2, name: 'Clube Nacional de Ginástica', city: 'Porto', address: 'Rua 2', sports: 'Padel' }
    ]);
    expect(names).toEqual(['Pavilhão Municipal']);

    service.suggest('cng', 'Porto', 'Padel').subscribe(result => {
      expect(result.venues.map(v => v.id)).toEqual([2]);
      expect(result.hasMore).toBeFalse();
    });
    http.expectNone(req => req.url === url || req.url === url + '/suggest');
  });

  it('does not download the full catalog for authentication failures or server errors', () => {
    for (const status of [401, 403, 500]) {
      let observed = 0;
      service.suggest('Campo', '', 'Padel').subscribe({
        error: (error: HttpErrorResponse) => observed = error.status
      });
      http.expectOne(req => req.url === url + '/suggest')
        .flush({}, { status, statusText: 'Error' });
      expect(observed).toBe(status);
      http.expectNone(req => req.url === url);
    }
  });

  it('invalidates the temporary cached catalog when a new venue is created', () => {
    service.suggest('', '', 'Padel').subscribe();
    http.expectOne(req => req.url === url + '/suggest')
      .flush({}, { status: 404, statusText: 'Not Found' });
    http.expectOne(req => req.url === url).flush([]);
    service.create({ name: 'Novo recinto' } as any).subscribe();
    http.expectOne(req => req.url === url && req.method === 'POST').flush({
      id: 99, name: 'Novo recinto', city: 'Lisboa', address: 'Rua Nova', sports: 'Padel'
    });
    service.suggest('', '', 'Padel').subscribe();
    http.expectOne(req => req.url === url && req.method === 'GET').flush([
      { id: 99, name: 'Novo recinto', city: 'Lisboa', address: 'Rua Nova', sports: 'Padel' }
    ]);
  });

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

  it('shows only venues inside the requested radius, ordered by actual distance', () => {
    let result: any[] = [];
    service.search(undefined, 'Padel', 38.72, -9.14, 25)
      .subscribe(venues => result = venues);
    const request = http.expectOne(req => req.url === url);
    request.flush([
      { id: 3, name: 'Fora do raio', latitude: 39.25, longitude: -9.14 },
      { id: 2, name: 'Mais longe', latitude: 38.81, longitude: -9.14 },
      { id: 4, name: 'Sem coordenadas', latitude: null, longitude: null },
      { id: 1, name: 'Mais perto', latitude: 38.721, longitude: -9.14 },
      { id: 5, name: 'Coordenadas inválidas', latitude: 900, longitude: -9.14 }
    ]);
    expect(result.map(venue => venue.id)).toEqual([1, 2]);
  });

  it('updates the radius correctly and never filters ordinary city searches by distance', () => {
    let insideTen: any[] = [];
    service.search(undefined, undefined, 38.72, -9.14, 10)
      .subscribe(venues => insideTen = venues);
    http.expectOne(req => req.url === url).flush([
      { id: 1, name: 'Próximo', latitude: 38.73, longitude: -9.14 },
      { id: 2, name: 'A 15 km', latitude: 38.855, longitude: -9.14 }
    ]);
    expect(insideTen.map(venue => venue.id)).toEqual([1]);

    let allCity: any[] = [];
    service.search('Lisboa', 'Padel').subscribe(venues => allCity = venues);
    http.expectOne(req => req.url === url).flush([
      { id: 3, name: 'Sem ponto no mapa', latitude: null, longitude: null }
    ]);
    expect(allCity.map(venue => venue.id)).toEqual([3]);
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
