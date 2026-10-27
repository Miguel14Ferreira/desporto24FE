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

  it('gets reverse-geocoded city and street via the app API', () => {
    let result: any;
    service.reverseLocation(38.72, -9.14, 79).subscribe(value => result=value);
    const req=http.expectOne(r=>r.url===url+'/reverse-location');
    expect(req.request.params.get('latitude')).toBe('38.72');
    expect(req.request.params.get('longitude')).toBe('-9.14');
    expect(req.request.params.get('accuracyMeters')).toBe('79');
    req.flush({city:'Lisboa',address:'Rua Julio Andrade',distanceMeters:26,provider:'My Geocode'});
    expect(result.city).toBe('Lisboa');
    expect(result.address).toBe('Rua Julio Andrade');
  });

  it('corrects coarse Sintra locality and missing address with a real Cacém street', () => {
    let result: any;
    service.reverseLocation(38.7692039, -9.3103216, 78).subscribe(value => result = value);
    http.expectOne(r => r.url === url + '/reverse-location').flush({
      city: 'Sintra', address: null, distanceMeters: 848, provider: 'My Geocode'
    });
    const nearest = http.expectOne(r => r.url === 'https://photon.komoot.io/reverse');
    expect(nearest.request.params.get('layer')).toBe('street');
    expect(nearest.request.params.get('radius')).toBe('0.5');
    nearest.flush({type:'FeatureCollection',features:[{
      properties:{type:'street',name:'Rua do Olival',district:'Cacém',
        city:'Cacém e São Marcos',postcode:'2735-303'},
      geometry:{coordinates:[-9.3104716,38.769178]}
    }]});
    expect(result.city).toBe('Cacém');
    expect(result.address).toBe('Rua do Olival');
    expect(result.provider).toBe('OpenStreetMap / Photon');
    expect(result.distanceMeters).toBeLessThan(25);
  });

  it('retrieves the street directly when the app API has a provider error', () => {
    let result: any;
    service.reverseLocation(38.7692039,-9.3103216,78).subscribe(value=>result=value);
    http.expectOne(r=>r.url===url+'/reverse-location')
      .flush(null,{status:503,statusText:'Unavailable'});
    http.expectOne(r=>r.url==='https://photon.komoot.io/reverse')
      .flush({features:[{properties:{type:'street',name:'Rua do Olival',district:'Cacém'},
        geometry:{coordinates:[-9.3104716,38.769178]}}]});
    expect(result.city).toBe('Cacém');
    expect(result.address).toBe('Rua do Olival');
  });

  it('falls back to My Geocode when the nearby OpenStreetMap service is unavailable', () => {
    let result: any;
    service.reverseLocation(38.72,-9.14,100).subscribe(value=>result=value);
    http.expectOne(r=>r.url===url+'/reverse-location')
      .flush(null,{status:504,statusText:'Gateway Timeout'});
    http.expectOne(r=>r.url==='https://photon.komoot.io/reverse')
      .flush(null,{status:503,statusText:'Unavailable'});
    http.expectOne(r=>r.url==='https://api.mygeocode.com/v1/reverse')
      .flush({status:'ok',result:{distance_m:800,
        components:{city:'Lisboa',road:'Rua distante'}}});
    expect(result.city).toBe('Lisboa');
    expect(result.address).toBeNull();
  });

  it('respects API rate limit rather than bypassing it through external providers', () => {
    let err: any;
    service.reverseLocation(38.72,-9.14,100).subscribe({error: value => err = value});
    http.expectOne(r=>r.url===url+'/reverse-location')
      .flush(null,{status:429,statusText:'Too Many Requests'});
    expect(err.status).toBe(429);
    http.expectNone(r => r.url.startsWith('https://photon.komoot.io'));
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
