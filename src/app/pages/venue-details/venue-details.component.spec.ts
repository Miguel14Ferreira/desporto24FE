import { ActivatedRoute, convertToParamMap, RouterModule } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { VenueDetailsModule } from './venue-details.module';
import { DomSanitizer } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';

import { VenueService } from '../../services/venue.service';
import { Venue } from '../model/venue';
import { VenueDetailsComponent } from './venue-details.component';

describe('VenueDetailsComponent', () => {
  const createVenue = (): Venue => ({
    id: 7,
    name: 'Pavilhão Central',
    city: 'Lisboa',
    address: 'Rua do Desporto',
    sports: 'Futsal',
    venueType: 'Pavilhão',
    ownershipType: 'PUBLIC',
    surfaceType: 'Madeira',
    environmentType: 'INDOOR',
    indoor: true,
    changingRooms: true,
    changingRoomTypes: null,
    toilets: true,
    lockers: true,
    showers: null,
    stands: null,
    drinkingFountain: null,
    accessible: true,
    firstAid: true,
    aed: true,
    medicalStation: null,
    lifeguard: null,
    staffOnSite: null,
    securitySurveillance: null,
    cafe: false,
    restaurant: null,
    vendingMachines: null,
    sportsShop: null,
    wifi: null,
    phoneCharging: null,
    nearbyRadiusMeters: null,
    nearbyPharmacy: null,
    nearbyAtm: null,
    services: null,
    transport: null,
    openingHours: null,
    priceInfo: null,
    website: null,
    contact: null,
    parking: true,
    freeParking: null,
    lighting: true,
    latitude: 38.7223,
    longitude: -9.1393,
    informationSource: 'COMMUNITY',
    createdByUsername: 'miguel',
    createdAt: '2026-09-29T20:00:00Z'
  });

  it('keeps the useful public venue information panel with a distinct action', async () => {
    const route = { snapshot: {
      data: { publicVenueView: true },
      paramMap: convertToParamMap({ id: '7' }),
      queryParamMap: convertToParamMap({})
    }} as unknown as ActivatedRoute;
    const api = jasmine.createSpyObj<VenueService>('VenueService',
      ['get', 'getRatingSummary', 'listPhotos', 'listSportConditions']);
    api.get.and.returnValue(of(createVenue()));
    api.getRatingSummary.and.returnValue(of({ venueId: 7, ratingCount: 0, averageScore: null }));

    await TestBed.configureTestingModule({
      imports: [VenueDetailsModule, RouterModule.forRoot([])],
      providers: [
        { provide: ActivatedRoute, useValue: route },
        { provide: VenueService, useValue: api }
      ]
    }).compileComponents();

    const fixture = TestBed.createComponent(VenueDetailsComponent);
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;

    expect(root.querySelector('.venue-basic-info')).not.toBeNull();
    expect(root.querySelector('.venue-visit-section')).not.toBeNull();
    expect(root.querySelector('.venue-information-section')).not.toBeNull();
    const info = root.querySelector<HTMLElement>('.venue-public-more');
    expect(info).not.toBeNull();
    expect(info?.tagName).toBe('ASIDE');
    expect(info?.querySelector('p')?.textContent).toContain('fotografias');
    expect(info?.querySelector('a.venue-public-more-link')?.getAttribute('href')).toBe('/menu/venues/7');
    // A shared vertical rhythm keeps the address cards separate from this message.
    const basicInfo = root.querySelector<HTMLElement>('.venue-basic-info');
    const shell = root.querySelector<HTMLElement>('.venue-detail-shell');
    expect(basicInfo?.nextElementSibling).toBe(info);
    expect(getComputedStyle(shell!).display).toBe('flex');
    expect(getComputedStyle(shell!).flexDirection).toBe('column');
    expect(getComputedStyle(info!).paddingTop).not.toBe('0px');
    expect(root.querySelector('.venue-photos-section')).toBeNull();
    expect(root.querySelector('.venue-sport-conditions-section')).toBeNull();
    expect(root.textContent).toContain('Abrir detalhes completos');
    expect(root.textContent).toContain('Para fotografias e contributos');
    expect(api.listPhotos).not.toHaveBeenCalled();
    expect(api.listSportConditions).not.toHaveBeenCalled();
    fixture.destroy();
  });

  it('opens a full venue from a public link without authentication-only requests', () => {
    const route = { snapshot: {
      data: { publicVenueView: true },
      paramMap: { get: (key: string) => key === 'id' ? '7' : null },
      queryParamMap: convertToParamMap({})
    }} as unknown as ActivatedRoute;
    const api = jasmine.createSpyObj<VenueService>('VenueService',
      ['get', 'getRatingSummary', 'listPhotos', 'listSportConditions', 'addPhoto', 'addSportCondition']);
    api.get.and.returnValue(of(createVenue()));
    api.getRatingSummary.and.returnValue(of({ venueId: 7, ratingCount: 0, averageScore: null }));
    const component = new VenueDetailsComponent(route, api);
    component.ngOnInit();

    expect(component.isPublicView).toBeTrue();
    expect(component.venue?.name).toBe('Pavilhão Central');
    expect(component.loading).toBeFalse();
    expect(component.photosLoading).toBeFalse();
    expect(component.sportConditionsLoading).toBeFalse();
    expect(api.get).toHaveBeenCalledOnceWith(7);
    expect(api.getRatingSummary).toHaveBeenCalledOnceWith(7);
    expect(api.listPhotos).not.toHaveBeenCalled();
    expect(api.listSportConditions).not.toHaveBeenCalled();
    component.retryPhotos();
    component.retrySportConditions();
    expect(api.listPhotos).not.toHaveBeenCalled();
    expect(api.listSportConditions).not.toHaveBeenCalled();
    component.ngOnDestroy();
  });

  it('preserves private venue functionality when the route has no public flag', () => {
    const route = { snapshot: {
      data: {},
      paramMap: { get: (key: string) => key === 'id' ? '7' : null },
      queryParamMap: convertToParamMap({})
    }} as unknown as ActivatedRoute;
    const api = jasmine.createSpyObj<VenueService>('VenueService',
      ['get', 'getRatingSummary', 'listPhotos', 'listSportConditions']);
    api.get.and.returnValue(of(createVenue()));
    api.getRatingSummary.and.returnValue(of({ venueId: 7, ratingCount: 0, averageScore: null }));
    api.listPhotos.and.returnValue(of([]));
    api.listSportConditions.and.returnValue(of([]));
    const component = new VenueDetailsComponent(route, api);
    component.ngOnInit();

    expect(component.isPublicView).toBeFalse();
    expect(api.listPhotos).toHaveBeenCalledOnceWith(7);
    expect(api.listSportConditions).toHaveBeenCalledOnceWith(7);
    component.ngOnDestroy();
  });

  it('offers an embedded map and verified-looking contact without needing Google credentials', () => {
    const sanitizer = jasmine.createSpyObj<DomSanitizer>('DomSanitizer', ['bypassSecurityTrustResourceUrl']);
    sanitizer.bypassSecurityTrustResourceUrl.and.callFake(url => ({ changingThisBreaksApplicationSecurity: url }) as any);
    const component = new VenueDetailsComponent({} as ActivatedRoute, {} as VenueService, null, sanitizer);
    component.venue = { ...createVenue(), contact: '+351 912 345 678' };
    const first = component.embeddedMapUrl;
    expect(first).toBeTruthy();
    expect(sanitizer.bypassSecurityTrustResourceUrl).toHaveBeenCalledOnceWith(
      jasmine.stringMatching(/^https:\/\/www\.openstreetmap\.org\/export\/embed\.html\?bbox=/)
    );
    expect(component.embeddedMapUrl).toBe(first); // cached SafeResourceUrl
    expect(component.publicTelephoneUrl).toBe('tel:+351912345678');
    expect(component.googleVenueContactUrl).toContain('Pavilh%C3%A3o%20Central');
    expect(component.googleVenueContactUrl).toContain('Lisboa');
  });

  it('flags an unconfirmed operator identity for Armando Pimentel without revealing a telephone', () => {
    const component = new VenueDetailsComponent({} as ActivatedRoute, {} as VenueService);
    component.venue = {
      ...createVenue(), id: 2655, name: 'Piscinas Engenheiro Armando Pimentel',
      city: 'Porto', district: 'Porto', address: 'Morada por confirmar',
      contact: null
    };
    expect(component.officialContactIdentityUnconfirmed).toBeTrue();
    expect(component.officialContactPageUrl)
      .toBe('https://www.agoraporto.pt/desporto/piscina-municipal-eng-o-armando-pimentel');
    expect(component.publicTelephoneUrl).toBeNull();
    component.venue = { ...component.venue, contact: '226179598' };
    expect(component.officialContactIdentityUnconfirmed).toBeFalse();
    expect(component.officialContactPageUrl).toBeNull();
  });

  it('does not show a fake pin or fake telephone if data is missing', () => {
    const sanitizer = jasmine.createSpyObj<DomSanitizer>('DomSanitizer', ['bypassSecurityTrustResourceUrl']);
    const component = new VenueDetailsComponent({} as ActivatedRoute, {} as VenueService, null, sanitizer);
    component.venue = { ...createVenue(), latitude: null, longitude: null, contact: 'recinto@example.pt' };
    expect(component.embeddedMapUrl).toBeNull();
    expect(component.publicTelephoneUrl).toBeNull();
    expect(component.googleVenueContactUrl).toContain('/maps/search/');
    expect(sanitizer.bypassSecurityTrustResourceUrl).not.toHaveBeenCalled();
  });

  it('links to precise coordinates when valid GPS data is present', () => {
    const component = new VenueDetailsComponent({} as ActivatedRoute, {} as VenueService);
    component.venue = createVenue();

    expect(component.hasConfirmedMapCoordinates).toBeTrue();
    expect(component.mapUrl).toBe('https://www.google.com/maps?q=38.7223,-9.1393');

    component.venue = { ...createVenue(), latitude: 0, longitude: 0 };
    expect(component.hasConfirmedMapCoordinates).toBeFalse();
    expect(component.mapUrl).toContain('/maps/search/?api=1&query=');

    component.venue = { ...createVenue(), latitude: 38.72, longitude: -5.5 };
    expect(component.hasConfirmedMapCoordinates).toBeFalse();
    expect(component.mapUrl).toContain('/maps/search/?api=1&query=');
  });

  it('maps island venues with a full GPS pin and OSM embedded map', () => {
    const sanitizer = jasmine.createSpyObj<DomSanitizer>('DomSanitizer',
      ['bypassSecurityTrustResourceUrl']);
    sanitizer.bypassSecurityTrustResourceUrl.and.callFake(value => value as any);
    const component = new VenueDetailsComponent({} as ActivatedRoute, {} as VenueService, null, sanitizer);
    for (const [latitude, longitude] of [[37.741, -25.675], [32.648, -16.908]]) {
      component.venue = { ...createVenue(), latitude, longitude, address: 'Morada por confirmar' };
      expect(component.hasConfirmedMapCoordinates).toBeTrue();
      expect(component.mapUrl).toBe('https://www.google.com/maps?q=' + latitude + ',' + longitude);
      expect(component.embeddedMapUrl).toBeTruthy();
      expect(component.postalAddress).toBeNull();
    }
  });

  it('offers travel modes only for valid catalogue GPS, never speculative address routes', () => {
    const component = new VenueDetailsComponent({} as ActivatedRoute, {} as VenueService);
    component.venue = createVenue();
    for (const mode of ['driving', 'walking', 'transit'] as const) {
      const url = new URL(component.directionsUrl(mode)!);
      expect(url.pathname).toBe('/maps/dir/');
      expect(url.searchParams.get('destination')).toBe('38.7223,-9.1393');
      expect(url.searchParams.get('travelmode')).toBe(mode);
    }
    component.venue = { ...createVenue(), latitude: null, longitude: null };
    expect(component.directionsUrl('walking')).toBeNull();
    component.venue = { ...createVenue(), latitude: 0, longitude: 0 };
    expect(component.directionsUrl('driving')).toBeNull();
  });

  it('hides generated GPS-only placeholders and still links to the mapped coordinates', () => {
    const component = new VenueDetailsComponent({} as ActivatedRoute, {} as VenueService);
    component.venue = {
      ...createVenue(), address: 'Localização no mapa: 38.7223, -9.1393 (morada por confirmar)',
      locationStatus: 'GPS_ONLY_ADDRESS_UNKNOWN'
    };

    expect(component.isGpsOnly).toBeTrue();
    expect(component.postalAddress).toBeNull();
    expect(component.mapUrl).toBe('https://www.google.com/maps?q=38.7223,-9.1393');
  });

  it('can handle old backend responses without locationStatus', () => {
    const component = new VenueDetailsComponent({} as ActivatedRoute, {} as VenueService);
    component.venue = { ...createVenue(), address: 'Morada por confirmar',
      latitude: 38.7223, longitude: -9.1393 };
    expect(component.isGpsOnly).toBeTrue();
    expect(component.postalAddress).toBeNull();

    component.venue = { ...createVenue(), address: 'Rua do Desporto 10' };
    expect(component.isGpsOnly).toBeFalse();
    expect(component.postalAddress).toBe('Rua do Desporto 10');
  });

  it('does not insert an unknown postal address into approximate map searches', () => {
    const component = new VenueDetailsComponent({} as ActivatedRoute, {} as VenueService);
    component.venue = { ...createVenue(), address: 'Morada por confirmar',
      latitude: null, longitude: null };
    expect(component.mapUrl).toContain('/maps/search/?api=1&query=');
    expect(component.mapUrl).not.toContain('confirmar');
    expect(component.postalAddress).toBeNull();
  });

  it('offers an explicit approximate address search when the venue lacks GPS coordinates', () => {
    const component = new VenueDetailsComponent({} as ActivatedRoute, {} as VenueService);
    component.venue = {
      ...createVenue(),
      name: 'Polidesportivo Municipal',
      city: 'Porto',
      district: 'Porto',
      address: 'Rua do Jogo 12',
      latitude: null,
      longitude: null
    };

    expect(component.hasConfirmedMapCoordinates).toBeFalse();
    const expected = encodeURIComponent('Polidesportivo Municipal, Rua do Jogo 12, Porto, Porto, Portugal');
    expect(component.mapUrl).toBe(`https://www.google.com/maps/search/?api=1&query=${expected}`);
  });

  it('never generates a coordinate link from invalid or incomplete GPS values', () => {
    const component = new VenueDetailsComponent({} as ActivatedRoute, {} as VenueService);
    component.venue = { ...createVenue(), latitude: 102, longitude: -9 };
    expect(component.hasConfirmedMapCoordinates).toBeFalse();
    expect(component.mapUrl).toContain('/maps/search/?api=1&query=');

    component.venue = { ...createVenue(), latitude: 38.72, longitude: null };
    expect(component.hasConfirmedMapCoordinates).toBeFalse();
    expect(component.mapUrl).toContain('/maps/search/?api=1&query=');

    component.venue = null;
    expect(component.mapUrl).toBeNull();
  });

  it('supports retrying a failed venue load without getting stuck on the loading state', () => {
    const route = {snapshot:{paramMap:{get: () => '7'}}} as unknown as ActivatedRoute;
    const api = jasmine.createSpyObj<VenueService>('VenueService', ['get']);
    api.get.and.returnValue(throwError(() => new Error('timeout')));
    const component = new VenueDetailsComponent(route, api);
    component.retryVenue();
    expect(component.loadError).toBeTrue();
    expect(component.loading).toBeFalse();
    api.get.and.returnValue(of(createVenue()));
    component.retryVenue();
    expect(component.loadError).toBeFalse();
    expect(component.venue?.id).toBe(7);
    expect(component.loading).toBeFalse();
  });

  it('loads the venue, photos and sport conditions from the route id', () => {
    const venue = createVenue();

    const route = {
      snapshot: {
        paramMap: {
          get: () => '7'
        }
      }
    } as unknown as ActivatedRoute;

    const venueService = jasmine.createSpyObj<VenueService>('VenueService', [
      'get',
      'getRatingSummary',
      'listPhotos',
      'listSportConditions',
      'addPhoto',
      'addSportCondition'
    ]);

    venueService.getRatingSummary.and.returnValue(of({venueId: 7, ratingCount: 0, averageScore: null}));
    venueService.get.and.returnValue(of(venue));
    venueService.listPhotos.and.returnValue(of([]));
    venueService.listSportConditions.and.returnValue(of([]));

    const component = new VenueDetailsComponent(route, venueService);

    component.ngOnInit();

    expect(venueService.get).toHaveBeenCalledOnceWith(7);
    expect(venueService.listPhotos).toHaveBeenCalledOnceWith(7);
    expect(venueService.listSportConditions).toHaveBeenCalledOnceWith(7);
    expect(venueService.getRatingSummary).toHaveBeenCalledOnceWith(7);
    expect(component.ratingSummary).toBeNull();
    expect(component.venue).toEqual(venue);
    expect(component.loading).toBeFalse();
    expect(component.photosLoading).toBeFalse();
    expect(component.sportConditionsLoading).toBeFalse();
    expect(component.loadError).toBeFalse();
  });

  it('displays a public average only after three different players rated', () => {
    const route = {snapshot:{paramMap:{get: () => '7'}}} as unknown as ActivatedRoute;
    const venueService = jasmine.createSpyObj<VenueService>('VenueService', [
      'get', 'getRatingSummary', 'listPhotos', 'listSportConditions'
    ]);
    venueService.get.and.returnValue(of(createVenue()));
    venueService.listPhotos.and.returnValue(of([]));
    venueService.listSportConditions.and.returnValue(of([]));
    venueService.getRatingSummary.and.returnValue(of({
      venueId: 7, ratingCount: 3, averageScore: 4.7
    }));
    const component = new VenueDetailsComponent(route, venueService);
    component.ngOnInit();
    expect(component.ratingSummary?.ratingCount).toBe(3);
    expect(component.ratingSummary?.averageScore).toBe(4.7);
  });

  it('keeps the venue usable when its ratings API is unavailable', () => {
    const route = {snapshot:{paramMap:{get: () => '7'}}} as unknown as ActivatedRoute;
    const venueService = jasmine.createSpyObj<VenueService>('VenueService', [
      'get', 'getRatingSummary', 'listPhotos', 'listSportConditions'
    ]);
    venueService.get.and.returnValue(of(createVenue()));
    venueService.listPhotos.and.returnValue(of([]));
    venueService.listSportConditions.and.returnValue(of([]));
    venueService.getRatingSummary.and.returnValue(throwError(() => new Error('unavailable')));
    const component = new VenueDetailsComponent(route, venueService);
    component.ngOnInit();
    expect(component.venue?.id).toBe(7);
    expect(component.ratingSummary).toBeNull();
    expect(component.ratingSummaryLoadError).toBeTrue();
    expect(component.loadError).toBeFalse();
  });

  it('marks the page as failed when loading the venue errors', () => {
    const route = {
      snapshot: {
        paramMap: {
          get: () => '7'
        }
      }
    } as unknown as ActivatedRoute;

    const venueService = jasmine.createSpyObj<VenueService>('VenueService', [
      'get',
      'getRatingSummary',
      'listPhotos',
      'listSportConditions',
      'addPhoto',
      'addSportCondition'
    ]);

    venueService.getRatingSummary.and.returnValue(of({venueId: 7, ratingCount: 0, averageScore: null}));
    venueService.get.and.returnValue(throwError(() => new Error('load failed')));
    venueService.listPhotos.and.returnValue(of([]));
    venueService.listSportConditions.and.returnValue(of([]));

    const component = new VenueDetailsComponent(route, venueService);

    component.ngOnInit();

    expect(venueService.get).toHaveBeenCalledOnceWith(7);
    expect(component.venue).toBeNull();
    expect(component.loading).toBeFalse();
    expect(component.loadError).toBeTrue();
  });

  it('marks sport conditions as failed when their loading errors', () => {
    const venue = createVenue();

    const route = {
      snapshot: {
        paramMap: {
          get: () => '7'
        }
      }
    } as unknown as ActivatedRoute;

    const venueService = jasmine.createSpyObj<VenueService>('VenueService', [
      'get',
      'getRatingSummary',
      'listPhotos',
      'listSportConditions',
      'addPhoto',
      'addSportCondition'
    ]);

    venueService.getRatingSummary.and.returnValue(of({venueId: 7, ratingCount: 0, averageScore: null}));
    venueService.get.and.returnValue(of(venue));
    venueService.listPhotos.and.returnValue(of([]));
    venueService.listSportConditions.and.returnValue(
      throwError(() => new Error('conditions failed'))
    );

    const component = new VenueDetailsComponent(route, venueService);

    component.ngOnInit();

    expect(component.venue).toEqual(venue);
    expect(component.sportConditions).toEqual([]);
    expect(component.sportConditionsLoading).toBeFalse();
    expect(component.sportConditionsLoadError).toBeTrue();
    expect(component.loadError).toBeFalse();
  });

  it('keeps the page usable when loading photos errors', () => {
    const venue = createVenue();

    const route = {
      snapshot: {
        paramMap: {
          get: () => '7'
        }
      }
    } as unknown as ActivatedRoute;

    const venueService = jasmine.createSpyObj<VenueService>('VenueService', [
      'get',
      'getRatingSummary',
      'listPhotos',
      'listSportConditions',
      'addPhoto',
      'addSportCondition'
    ]);

    venueService.getRatingSummary.and.returnValue(of({venueId: 7, ratingCount: 0, averageScore: null}));
    venueService.get.and.returnValue(of(venue));
    venueService.listPhotos.and.returnValue(
      throwError(() => new Error('photos failed'))
    );
    venueService.listSportConditions.and.returnValue(of([]));

    const component = new VenueDetailsComponent(route, venueService);

    component.ngOnInit();

    expect(component.venue).toEqual(venue);
    expect(component.photos).toEqual([]);
    expect(component.photosLoading).toBeFalse();
    expect(component.photosLoadError).toBeTrue();
    expect(component.loadError).toBeFalse();
  });

  it('retries loading photos after an error', () => {
    const route = {} as ActivatedRoute;
    const venueService = jasmine.createSpyObj<VenueService>('VenueService', [
      'listPhotos'
    ]);
    const photo = {
      id: 21,
      photoUrl: 'https://cdn.example.com/venue.jpg',
      uploadedByUsername: 'miguel',
      createdAt: '2026-09-29T20:10:00Z'
    };

    venueService.listPhotos.and.returnValues(
      throwError(() => new Error('photos failed')),
      of([photo])
    );

    const component = new VenueDetailsComponent(route, venueService);
    component.venue = { id: 7 } as Venue;

    component.retryPhotos();
    expect(component.photosLoadError).toBeTrue();

    component.retryPhotos();

    expect(venueService.listPhotos).toHaveBeenCalledTimes(2);
    expect(venueService.listPhotos).toHaveBeenCalledWith(7);
    expect(component.photos).toEqual([photo]);
    expect(component.photosLoading).toBeFalse();
    expect(component.photosLoadError).toBeFalse();
  });

  it('retries loading sport conditions after an error', () => {
    const route = {} as ActivatedRoute;
    const venueService = jasmine.createSpyObj<VenueService>('VenueService', [
      'listSportConditions'
    ]);
    const condition = {
      id: 12,
      sport: 'Padel',
      conditions: 'Piso rápido',
      informationSource: 'COMMUNITY' as const,
      createdByUsername: 'miguel',
      createdAt: '2026-09-29T20:00:00Z'
    };

    venueService.listSportConditions.and.returnValues(
      throwError(() => new Error('conditions failed')),
      of([condition])
    );

    const component = new VenueDetailsComponent(route, venueService);
    component.venue = { id: 7 } as Venue;

    component.retrySportConditions();
    expect(component.sportConditionsLoadError).toBeTrue();

    component.retrySportConditions();

    expect(venueService.listSportConditions).toHaveBeenCalledTimes(2);
    expect(venueService.listSportConditions).toHaveBeenCalledWith(7);
    expect(component.sportConditions).toEqual([condition]);
    expect(component.sportConditionsLoading).toBeFalse();
    expect(component.sportConditionsLoadError).toBeFalse();
  });

  it('adds a sport condition and resets the form on success', () => {
    const route = {} as ActivatedRoute;
    const venueService = jasmine.createSpyObj<VenueService>('VenueService', [
      'addSportCondition'
    ]);
    const createdCondition = {
      id: 12,
      sport: 'Padel',
      conditions: 'Piso rápido',
      informationSource: 'COMMUNITY' as const,
      createdByUsername: 'miguel',
      createdAt: '2026-09-29T20:00:00Z'
    };

    venueService.addSportCondition.and.returnValue(of(createdCondition));

    const component = new VenueDetailsComponent(route, venueService);
    component.venue = { id: 7 } as Venue;
    component.sportConditionSport = '  Padel  ';
    component.sportConditionText = '  Piso rápido  ';
    component.sportConditionsLoadError = true;

    component.addSportCondition();

    expect(venueService.addSportCondition).toHaveBeenCalledOnceWith(7, {
      sport: 'Padel',
      conditions: 'Piso rápido'
    });
    expect(component.sportConditions[0]).toEqual(createdCondition);
    expect(component.sportConditionSport).toBe('');
    expect(component.sportConditionText).toBe('');
    expect(component.sportConditionSaving).toBeFalse();
    expect(component.sportConditionSaveError).toBeFalse();
    expect(component.sportConditionsLoadError).toBeFalse();
  });

  it('keeps the sport condition form filled when saving errors', () => {
    const route = {} as ActivatedRoute;
    const venueService = jasmine.createSpyObj<VenueService>('VenueService', [
      'addSportCondition'
    ]);

    venueService.addSportCondition.and.returnValue(
      throwError(() => new Error('save failed'))
    );

    const component = new VenueDetailsComponent(route, venueService);
    component.venue = { id: 7 } as Venue;
    component.sportConditionSport = 'Padel';
    component.sportConditionText = 'Piso rápido';

    component.addSportCondition();

    expect(venueService.addSportCondition).toHaveBeenCalledOnceWith(7, {
      sport: 'Padel',
      conditions: 'Piso rápido'
    });
    expect(component.sportConditions).toEqual([]);
    expect(component.sportConditionSport).toBe('Padel');
    expect(component.sportConditionText).toBe('Piso rápido');
    expect(component.sportConditionSaving).toBeFalse();
    expect(component.sportConditionSaveError).toBeTrue();
  });

  it('uploads a photo and adds it to the gallery on success', () => {
    const route = {} as ActivatedRoute;
    const venueService = jasmine.createSpyObj<VenueService>('VenueService', [
      'addPhoto'
    ]);
    const file = new File(['photo'], 'venue.jpg', { type: 'image/jpeg' });
    const createdPhoto = {
      id: 21,
      photoUrl: 'https://cdn.example.com/venue.jpg',
      uploadedByUsername: 'miguel',
      createdAt: '2026-09-29T20:10:00Z'
    };
    const input = {
      files: [file],
      value: 'C:\\fakepath\\venue.jpg'
    } as unknown as HTMLInputElement;

    venueService.addPhoto.and.returnValue(of(createdPhoto));

    const component = new VenueDetailsComponent(route, venueService);
    component.venue = { id: 7 } as Venue;
    component.photosLoadError = true;

    component.uploadPhoto({ target: input } as unknown as Event);

    expect(venueService.addPhoto).toHaveBeenCalledOnceWith(7, file);
    expect(component.photos[0]).toEqual(createdPhoto);
    expect(input.value).toBe('');
    expect(component.photoUploading).toBeFalse();
    expect(component.photoUploadError).toBeFalse();
    expect(component.photosLoadError).toBeFalse();
  });

  it('marks the photo upload as failed when saving errors', () => {
    const route = {} as ActivatedRoute;
    const venueService = jasmine.createSpyObj<VenueService>('VenueService', [
      'addPhoto'
    ]);
    const file = new File(['photo'], 'venue.jpg', { type: 'image/jpeg' });
    const input = {
      files: [file],
      value: 'C:\\fakepath\\venue.jpg'
    } as unknown as HTMLInputElement;

    venueService.addPhoto.and.returnValue(
      throwError(() => new Error('upload failed'))
    );

    const component = new VenueDetailsComponent(route, venueService);
    component.venue = { id: 7 } as Venue;

    component.uploadPhoto({ target: input } as unknown as Event);

    expect(venueService.addPhoto).toHaveBeenCalledOnceWith(7, file);
    expect(component.photos).toEqual([]);
    expect(input.value).toBe('');
    expect(component.photoUploading).toBeFalse();
    expect(component.photoUploadError).toBeTrue();
  });

  it('rejects a non-image photo upload before calling the API', () => {
    const route = {} as ActivatedRoute;
    const venueService = jasmine.createSpyObj<VenueService>('VenueService', [
      'addPhoto'
    ]);
    const file = new File(['document'], 'venue.txt', { type: 'text/plain' });
    const input = {
      files: [file],
      value: 'C:\\fakepath\\venue.txt'
    } as unknown as HTMLInputElement;

    const component = new VenueDetailsComponent(route, venueService);
    component.venue = { id: 7 } as Venue;

    component.uploadPhoto({ target: input } as unknown as Event);

    expect(venueService.addPhoto).not.toHaveBeenCalled();
    expect(component.photos).toEqual([]);
    expect(input.value).toBe('');
    expect(component.photoUploading).toBeFalse();
    expect(component.photoUploadError).toBeTrue();
  });

  it('rejects an invalid route id without calling the venue APIs', () => {
    const route = {
      snapshot: {
        paramMap: {
          get: () => 'invalid'
        }
      }
    } as unknown as ActivatedRoute;

    const venueService = jasmine.createSpyObj<VenueService>('VenueService', [
      'get',
      'getRatingSummary',
      'listPhotos',
      'listSportConditions',
      'addPhoto',
      'addSportCondition'
    ]);

    const component = new VenueDetailsComponent(route, venueService);

    component.ngOnInit();

    expect(venueService.get).not.toHaveBeenCalled();
    expect(venueService.listPhotos).not.toHaveBeenCalled();
    expect(venueService.listSportConditions).not.toHaveBeenCalled();
    expect(component.venue).toBeNull();
    expect(component.loading).toBeFalse();
    expect(component.photosLoading).toBeFalse();
    expect(component.sportConditionsLoading).toBeFalse();
    expect(component.loadError).toBeTrue();
  });
  it('keeps directory filters and page in the visible return link', () => {
    const route = { snapshot: {
      queryParamMap: convertToParamMap({ page: '3', district: 'Lisboa',
        name: 'Campo', sport: 'Futebol' })
    } } as unknown as ActivatedRoute;
    const component = new VenueDetailsComponent(route, {} as VenueService);
    expect(component.backToDirectoryQueryParams).toEqual({
      name: 'Campo', district: 'Lisboa', sport: 'Futebol', page: 3
    });
  });

  it('preserves nearby-locality mode, safe radius and page on the return link', () => {
    const route = { snapshot: {
      queryParamMap: convertToParamMap({ page: '2', city: 'Cacém', sport: 'Padel',
        nearby: '1', radiusKm: '50' })
    } } as unknown as ActivatedRoute;
    const component = new VenueDetailsComponent(route, {} as VenueService);
    expect(component.backToDirectoryQueryParams).toEqual({
      city: 'Cacém', sport: 'Padel', page: 2, nearby: 1, radiusKm: 50
    });
  });

  it('does not preserve nearby mode when name/district make it incompatible', () => {
    const route = { snapshot: {
      queryParamMap: convertToParamMap({ city: 'Cacém', name: 'Campo',
        nearby: '1', radiusKm: '99' })
    } } as unknown as ActivatedRoute;
    const component = new VenueDetailsComponent(route, {} as VenueService);
    expect(component.backToDirectoryQueryParams).toEqual({
      city: 'Cacém', name: 'Campo'
    });
  });

  it('does not accept out-of-range catalogue pages when returning', () => {
    const route = { snapshot: {
      queryParamMap: convertToParamMap({page: '-1', city: 'Lisboa'})
    } } as unknown as ActivatedRoute;
    const component = new VenueDetailsComponent(route, {} as VenueService);
    expect(component.backToDirectoryQueryParams).toEqual({ city: 'Lisboa' });
  });

  it('translates venue type and surface in English, preserving the response values', async () => {
    const originalLanguage = localStorage.getItem('d24-language');
    const route = { snapshot: {
      data: { publicVenueView: true },
      paramMap: convertToParamMap({ id: '7' }),
      queryParamMap: convertToParamMap({})
    }} as unknown as ActivatedRoute;
    const venue = {...createVenue(),
      venueType: 'Equipamento desportivo', surfaceType: 'Madeira',
      sports: 'Canoagem;Windsurf;Stand Up Paddle'};
    const api = jasmine.createSpyObj<VenueService>('VenueService',
      ['get', 'getRatingSummary', 'listPhotos', 'listSportConditions']);
    api.get.and.returnValue(of(venue));
    api.getRatingSummary.and.returnValue(of({venueId: 7, ratingCount: 0, averageScore: null}));
    try {
      localStorage.setItem('d24-language', 'en');
      await import('../../i18n/i18n.service').then(module => module.preloadEnglishTranslations());
      TestBed.resetTestingModule();
      await TestBed.configureTestingModule({
        imports: [VenueDetailsModule, RouterModule.forRoot([])],
        providers: [
          { provide: ActivatedRoute, useValue: route },
          { provide: VenueService, useValue: api }
        ]
      }).compileComponents();
      const fixture = TestBed.createComponent(VenueDetailsComponent);
      fixture.detectChanges();
      const root: HTMLElement = fixture.nativeElement;
      const info = root.querySelector('.venue-information-section')!;
      expect(info.textContent).toContain('Sports facility');
      expect(info.textContent).toContain('Wood');
      expect(info.textContent).toContain('Canoeing');
      expect(info.textContent).not.toContain('Equipamento desportivo');
      expect(venue.venueType).toBe('Equipamento desportivo');
      expect(venue.sports).toBe('Canoagem;Windsurf;Stand Up Paddle');
      fixture.destroy();
    } finally {
      if (originalLanguage === null) localStorage.removeItem('d24-language');
      else localStorage.setItem('d24-language', originalLanguage);
    }
  });

});
