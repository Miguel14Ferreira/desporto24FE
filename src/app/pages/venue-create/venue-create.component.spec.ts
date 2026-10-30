import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';

import { VenueService } from '../../services/venue.service';
import { Venue } from '../model/venue';
import { VenueCreateComponent } from './venue-create.component';

describe('VenueCreateComponent', () => {
  it('starts with no preselected environment and tracks five essential fields', () => {
    const service = jasmine.createSpyObj<VenueService>('VenueService', ['submitSuggestion']);
    const router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    const component = new VenueCreateComponent(service, router);
    expect(component.environmentType).toBeNull();
    expect(component.essentialCompletedCount).toBe(0);
    component.name = 'Campo de Teste';
    component.city = 'Sintra';
    component.address = 'Rua do Campo';
    component.selectedSports = ['Futebol'];
    expect(component.essentialCompletedCount).toBe(4);
    component.save();
    expect(component.validationError).toBeTrue();
    expect(service.submitSuggestion).not.toHaveBeenCalled();

    component.environmentType = 'INDOOR';
    expect(component.essentialCompletedCount).toBe(5);
    service.submitSuggestion.and.returnValue(of({id:13,status:'PENDING'}));
    component.save();
    expect(component.submitted).toBeTrue();
    expect(service.submitSuggestion).toHaveBeenCalledOnceWith(
      jasmine.objectContaining({ environmentType: 'INDOOR', indoor: true })
    );
  });

  it('counts valid GPS instead of a postal address for the essential location field', () => {
    const service = jasmine.createSpyObj<VenueService>('VenueService', ['submitSuggestion']);
    const router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    const component = new VenueCreateComponent(service, router);
    component.name = 'Parque';
    component.city = 'Porto';
    component.selectedSports = ['Corrida'];
    component.latitude = 41.14;
    component.longitude = -8.61;
    component.environmentType = 'OUTDOOR';
    expect(component.essentialCompletedCount).toBe(5);
    component.longitude = null;
    expect(component.essentialCompletedCount).toBe(4);
  });

  it('allows GPS-only venue creation, sending null instead of fabricating an address', () => {
    const service = jasmine.createSpyObj<VenueService>('VenueService', ['submitSuggestion']);
    const router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    service.submitSuggestion.and.returnValue(of({ id: 55, status: 'PENDING' }));
    const component = new VenueCreateComponent(service, router);
    component.environmentType = 'OUTDOOR';
    component.name = 'Pavilhão do Bairro';
    component.city = 'Cantanhede';
    component.selectedSports = ['Futsal'];
    component.latitude = 40.344;
    component.longitude = -8.588;

    expect(component.hasValidGpsCoordinates).toBeTrue();
    expect(component.locationIsMissing).toBeFalse();
    component.save();

    expect(service.submitSuggestion).toHaveBeenCalledOnceWith(jasmine.objectContaining({
      address: null, latitude: 40.344, longitude: -8.588
    }));
    expect(router.navigate).not.toHaveBeenCalled();
    expect(component.submitted).toBeTrue();
  });

  it('rejects missing, incomplete and foreign coordinates when the postal address is absent', () => {
    const service = jasmine.createSpyObj<VenueService>('VenueService', ['submitSuggestion']);
    const router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    const component = new VenueCreateComponent(service, router);
    component.environmentType = 'OUTDOOR';
    component.name = 'Campo do Bairro';
    component.city = 'Lisboa';
    component.selectedSports = ['Futsal'];
    for (const [lat, lon] of [
      [null, null], [40.3, null], [null, -8.2],
      [45, -8.2], [Number.NaN, -8.2], [40.3, -14]
    ] as Array<[number | null, number | null]>) {
      component.latitude = lat;
      component.longitude = lon;
      component.validationError = false;
      component.save();
      expect(component.validationError).toBeTrue();
    }
    expect(service.submitSuggestion).not.toHaveBeenCalled();
  });

  it('keeps existing address-based venue creation without GPS compatible', () => {
    const service = jasmine.createSpyObj<VenueService>('VenueService', ['submitSuggestion']);
    const router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    service.submitSuggestion.and.returnValue(of({ id: 22, status: 'PENDING' }));
    const component = new VenueCreateComponent(service, router);
    component.environmentType = 'OUTDOOR';
    component.name = 'Campo Central';
    component.city = 'Porto';
    component.address = 'Rua do Desporto 12';
    component.selectedSports = ['Futebol'];
    component.save();
    expect(service.submitSuggestion).toHaveBeenCalledOnceWith(jasmine.objectContaining({
      address: 'Rua do Desporto 12', latitude: null, longitude: null
    }));
  });

  it('prefills a valid favorite sport and locality from Discover without auto-saving', () => {
    const venueService = jasmine.createSpyObj<VenueService>('VenueService', ['submitSuggestion']);
    const router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    const route = {
      snapshot: { queryParamMap: convertToParamMap({ sport: '  pAdEl  ', city: '  Lisboa  ' }) }
    } as unknown as ActivatedRoute;
    const component = new VenueCreateComponent(venueService, router, route);
    component.environmentType = 'OUTDOOR';
    component.ngOnInit();

    expect(component.city).toBe('Lisboa');
    expect(component.district).toBeNull();
    expect(component.selectedSports).toEqual(['Padel']);
    expect(component.isSportSelected('Padel')).toBeTrue();
    expect(component.latitude).toBeNull();
    expect(component.longitude).toBeNull();

    // Both prefilled values remain editable.
    component.toggleSport('Padel', false);
    component.toggleSport('Ténis', true);
    component.city = 'Sintra';
    expect(component.selectedSports).toEqual(['Ténis']);
    expect(component.city).toBe('Sintra');
    expect(venueService.submitSuggestion).not.toHaveBeenCalled();
  });

  it('passes a valid mainland district through to the existing backend contract', () => {
    const service = jasmine.createSpyObj<VenueService>('VenueService', ['submitSuggestion']);
    const router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    service.submitSuggestion.and.returnValue(of({ id: 18, status: 'PENDING' }));
    const component = new VenueCreateComponent(service, router);
    component.environmentType = 'OUTDOOR';
    component.name = 'Campo Municipal';
    component.city = 'Cascais';
    component.district = 'Lisboa';
    component.address = 'Rua A';
    component.selectedSports = ['Futebol'];

    component.save();

    expect(service.submitSuggestion).toHaveBeenCalledOnceWith(
      jasmine.objectContaining({ district: 'Lisboa' })
    );
  });

  it('prefills only a known district from Discover without assuming one from city', () => {
    const service = jasmine.createSpyObj<VenueService>('VenueService', ['submitSuggestion']);
    const router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    const route = {
      snapshot: { queryParamMap: convertToParamMap({
        city: 'Sintra', district: 'Lisboa'
      }) }
    } as unknown as ActivatedRoute;
    const component = new VenueCreateComponent(service, router, route);
    component.environmentType = 'OUTDOOR';
    component.ngOnInit();
    expect(component.district).toBe('Lisboa');

    const routeInvalid = {
      snapshot: { queryParamMap: convertToParamMap({
        city: 'Santa Cruz', district: 'Madeira'
      }) }
    } as unknown as ActivatedRoute;
    const invalid = new VenueCreateComponent(service, router, routeInvalid);
    invalid.ngOnInit();
    expect(invalid.district).toBeNull();
  });

  it('rejects an unknown sport without losing the locality passed from Discover', () => {
    const venueService = jasmine.createSpyObj<VenueService>('VenueService', ['submitSuggestion']);
    const router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    const route = {
      snapshot: { queryParamMap: convertToParamMap({ sport: 'Outro desporto', city: 'Porto' }) }
    } as unknown as ActivatedRoute;
    const component = new VenueCreateComponent(venueService, router, route);
    component.environmentType = 'OUTDOOR';
    component.ngOnInit();

    expect(component.selectedSports).toEqual([]);
    expect(component.city).toBe('Porto');
  });

  it('uses bounded autocomplete only after the user explicitly asks to check for duplicates', () => {
    const service = jasmine.createSpyObj<VenueService>('VenueService', ['submitSuggestion', 'suggest']);
    const router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    service.suggest.and.returnValue(of({
      venues: [{ id: 33, name: 'Pavilhão Norte', city: 'Cascais' } as Venue],
      page: 0, hasMore: false
    }));
    const component = new VenueCreateComponent(service, router);
    component.environmentType = 'OUTDOOR';
    component.name = 'Pavilhão';
    component.city = 'Cascais';

    expect(service.suggest).not.toHaveBeenCalled();
    component.checkSimilarVenues();

    expect(service.suggest).toHaveBeenCalledOnceWith('Pavilhão', 'Cascais', undefined, 0);
    expect(component.similarVenueCheckComplete).toBeTrue();
    expect(component.similarVenues.map(venue => venue.id)).toEqual([33]);
    expect(component.checkingSimilarVenues).toBeFalse();
    expect(service.submitSuggestion).not.toHaveBeenCalled();
  });

  it('ignores a stale autocomplete response after the name or city changes', () => {
    const service = jasmine.createSpyObj<VenueService>('VenueService', ['submitSuggestion', 'suggest']);
    const router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    const oldRequest = new Subject<{ venues: Venue[]; page: number; hasMore: boolean }>();
    service.suggest.and.returnValue(oldRequest.asObservable());
    const component = new VenueCreateComponent(service, router);
    component.environmentType = 'OUTDOOR';
    component.name = 'Campo';
    component.city = 'Sintra';
    component.checkSimilarVenues();
    expect(component.checkingSimilarVenues).toBeTrue();

    component.city = 'Cascais';
    component.resetSimilarVenueCheck();
    oldRequest.next({
      venues: [{ id: 99, name: 'Campo antigo', city: 'Sintra' } as Venue],
      page: 0, hasMore: false
    });
    oldRequest.complete();

    expect(component.similarVenues).toEqual([]);
    expect(component.similarVenueCheckComplete).toBeFalse();
    expect(component.checkingSimilarVenues).toBeFalse();
  });

  it('does not block saving when the optional duplicate check fails', () => {
    const service = jasmine.createSpyObj<VenueService>('VenueService', ['submitSuggestion', 'suggest']);
    const router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    service.suggest.and.returnValue(throwError(() => new Error('search unavailable')));
    service.submitSuggestion.and.returnValue(of({ id: 8, status: 'PENDING' }));
    const component = new VenueCreateComponent(service, router);
    component.environmentType = 'OUTDOOR';
    component.name = 'Campo Novo';
    component.city = 'Lisboa';
    component.address = 'Rua Nova';
    component.selectedSports = ['Futsal'];

    component.checkSimilarVenues();
    expect(component.similarVenueCheckError).toBeTrue();
    expect(component.checkingSimilarVenues).toBeFalse();
    component.save();

    expect(service.submitSuggestion).toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(component.submitted).toBeTrue();
  });

  it('does not submit when required fields are missing', () => {
    const venueService = jasmine.createSpyObj<VenueService>('VenueService', ['submitSuggestion']);
    const router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    const component = new VenueCreateComponent(venueService, router);
    component.environmentType = 'OUTDOOR';

    component.name = 'Pavilhão Central';
    component.city = '';
    component.address = 'Rua do Desporto';

    component.save();

    expect(venueService.submitSuggestion).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(component.validationError).toBeTrue();
    expect(component.saving).toBeFalse();
  });

  it('requires a selected sport before creating a venue', () => {
    const venueService = jasmine.createSpyObj<VenueService>('VenueService', ['submitSuggestion']);
    const router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    venueService.submitSuggestion.and.returnValue(of({ id: 9, status: 'PENDING' }));
    const component = new VenueCreateComponent(venueService, router);
    component.environmentType = 'OUTDOOR';
    component.name = 'Pavilhão Central';
    component.city = 'Lisboa';
    component.address = 'Rua do Desporto';

    component.save();

    expect(component.validationError).toBeTrue();
    expect(component.saving).toBeFalse();
    expect(venueService.submitSuggestion).not.toHaveBeenCalled();

    component.toggleSport('Padel', true);
    component.save();

    expect(component.validationError).toBeFalse();
    expect(venueService.submitSuggestion).toHaveBeenCalledOnceWith(
      jasmine.objectContaining({ sports: 'Padel' })
    );
    expect(router.navigate).not.toHaveBeenCalled();
    expect(component.submitted).toBeTrue();
  });

  it('submits a venue suggestion without publishing or navigating to a venue detail page', () => {
    const venueService = jasmine.createSpyObj<VenueService>('VenueService', ['submitSuggestion']);
    const router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    const venue = { id: 7, status: 'PENDING' };
    venueService.submitSuggestion.and.returnValue(of(venue));

    const component = new VenueCreateComponent(venueService, router);
    component.environmentType = 'OUTDOOR';
    component.name = '  Pavilhão Central  ';
    component.city = '  Lisboa  ';
    component.address = '  Rua do Desporto  ';
    component.selectedSports = ['Futsal', 'Padel'];
    component.environmentType = 'BOTH';
    component.website = '  https://pavilhao.example  ';
    component.contact = '  +351 210 000 000  ';
    component.changingRooms = true;
    component.changingRoomTypes = ['MALE', 'FEMALE', 'ADAPTED'];
    component.showers = true;
    component.stands = true;
    component.drinkingFountain = true;
    component.medicalStation = true;
    component.lifeguard = true;
    component.staffOnSite = true;
    component.securitySurveillance = true;
    component.restaurant = true;
    component.vendingMachines = true;
    component.sportsShop = true;
    component.wifi = true;
    component.phoneCharging = true;
    component.parking = true;
    component.freeParking = true;
    component.nearbyRadiusMeters = 1000;
    component.nearbyPharmacy = true;
    component.nearbyAtm = true;

    component.save();

    expect(venueService.submitSuggestion).toHaveBeenCalledOnceWith(jasmine.objectContaining({
      name: 'Pavilhão Central', city: 'Lisboa', address: 'Rua do Desporto',
      sports: 'Futsal;Padel', environmentType: 'BOTH', indoor: true,
      website: 'https://pavilhao.example', contact: '+351 210 000 000', changingRooms: true, changingRoomTypes: 'MALE;FEMALE;ADAPTED', showers: true, stands: true, drinkingFountain: true, medicalStation: true, lifeguard: true, staffOnSite: true, securitySurveillance: true, restaurant: true, vendingMachines: true, sportsShop: true, wifi: true, phoneCharging: true, parking: true, freeParking: true, nearbyRadiusMeters: 1000, nearbyPharmacy: true, nearbyAtm: true, latitude: null, longitude: null
    }));
    expect(router.navigate).not.toHaveBeenCalled();
    expect(component.submitted).toBeTrue();
    expect(component.validationError).toBeFalse();
    expect(component.saveError).toBeFalse();
    expect(component.saving).toBeFalse();
  });

  it('derives the indoor flag consistently from the environment', () => {
    const cases: { environment: 'INDOOR' | 'OUTDOOR' | 'BOTH'; indoor: boolean }[] = [
      { environment: 'INDOOR', indoor: true },
      { environment: 'OUTDOOR', indoor: false },
      { environment: 'BOTH', indoor: true }
    ];

    for (const { environment, indoor } of cases) {
      const venueService = jasmine.createSpyObj<VenueService>('VenueService', ['submitSuggestion']);
      const router = jasmine.createSpyObj<Router>('Router', ['navigate']);
      venueService.submitSuggestion.and.returnValue(of({ id: 7, status: 'PENDING' }));

      const component = new VenueCreateComponent(venueService, router);
    component.environmentType = 'OUTDOOR';
      component.name = 'Recinto de teste';
      component.city = 'Lisboa';
      component.address = 'Rua do Desporto';
      component.selectedSports = ['Futsal'];
      component.environmentType = environment;

      component.save();

      expect(venueService.submitSuggestion).toHaveBeenCalledOnceWith(
        jasmine.objectContaining({ environmentType: environment, indoor })
      );
    }
  });

  it('adds and removes sports from the multi-selection', () => {
    const venueService = jasmine.createSpyObj<VenueService>('VenueService', ['submitSuggestion']);
    const router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    const component = new VenueCreateComponent(venueService, router);
    component.environmentType = 'OUTDOOR';

    component.toggleSport('Futsal', true);
    component.toggleSport('Padel', true);
    component.toggleSport('Futsal', false);

    expect(component.selectedSports).toEqual(['Padel']);
    expect(component.isSportSelected('Padel')).toBeTrue();
    expect(component.isSportSelected('Futsal')).toBeFalse();
  });

  it('starts with eight popular sports and gives access to the whole catalog', () => {
    const service = jasmine.createSpyObj<VenueService>('VenueService', ['submitSuggestion']);
    const router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    const component = new VenueCreateComponent(service, router);
    component.environmentType = 'OUTDOOR';

    expect(component.visibleSports).toEqual([
      'Futebol', 'Futsal', 'Padel', 'Ténis',
      'Basquetebol', 'Natação', 'Voleibol', 'Musculação'
    ]);

    component.showAllSports = true;
    expect(component.visibleSports).toEqual([...component.sportsCatalog]);
  });

  it('searches all sports without accents and preserves multiple selections', () => {
    const service = jasmine.createSpyObj<VenueService>('VenueService', ['submitSuggestion']);
    const router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    const component = new VenueCreateComponent(service, router);
    component.environmentType = 'OUTDOOR';

    component.sportSearch = 'TENIS';
    expect(component.visibleSports).toContain('Ténis');
    component.toggleSport('Ténis', true);
    component.sportSearch = 'natacao';
    expect(component.visibleSports).toContain('Natação');
    component.toggleSport('Natação', true);

    expect(component.selectedSports).toEqual(['Ténis', 'Natação']);
    component.sportSearch = '';
    expect(component.visibleSports).not.toContain('Ténis');
    component.toggleSport('Ténis', false);
    expect(component.visibleSports).toContain('Ténis');

    component.sportSearch = 'desporto inexistente';
    expect(component.visibleSports).toEqual([]);
  });

  it('shows an error and stays on the form when creation fails', () => {
    const venueService = jasmine.createSpyObj<VenueService>('VenueService', ['submitSuggestion']);
    const router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    venueService.submitSuggestion.and.returnValue(throwError(() => new Error('create failed')));

    const component = new VenueCreateComponent(venueService, router);
    component.environmentType = 'OUTDOOR';
    component.name = 'Pavilhão Central';
    component.city = 'Lisboa';
    component.address = 'Rua do Desporto';
    component.selectedSports = ['Futsal'];

    component.save();

    expect(venueService.submitSuggestion).toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(component.saveError).toBeTrue();
    expect(component.saving).toBeFalse();
  });
  it('fills coordinates from the current location', () => {
    const venueService = jasmine.createSpyObj<VenueService>('VenueService', ['submitSuggestion']);
    const router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    const component = new VenueCreateComponent(venueService, router);
    component.environmentType = 'OUTDOOR';
    const geolocation = spyOn(navigator.geolocation, 'getCurrentPosition');

    geolocation.and.callFake(success => success({
      coords: { latitude: 38.7223, longitude: -9.1393 }
    } as GeolocationPosition));

    component.useCurrentLocation();

    expect(component.latitude).toBe(38.7223);
    expect(component.longitude).toBe(-9.1393);
    expect(component.locationError).toBeFalse();
    expect(component.locating).toBeFalse();
  });

  it('shows an error when current location cannot be obtained', () => {
    const venueService = jasmine.createSpyObj<VenueService>('VenueService', ['submitSuggestion']);
    const router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    const component = new VenueCreateComponent(venueService, router);
    component.environmentType = 'OUTDOOR';
    const geolocation = spyOn(navigator.geolocation, 'getCurrentPosition');

    geolocation.and.callFake((_success, error) => error?.({
      code: 1,
      message: 'permission denied',
      PERMISSION_DENIED: 1,
      POSITION_UNAVAILABLE: 2,
      TIMEOUT: 3
    } as GeolocationPositionError));

    component.useCurrentLocation();

    expect(component.locationError).toBeTrue();
    expect(component.locating).toBeFalse();
  });
  it('preserves unknown and explicit optional amenities in the request', () => {
    const venueService = jasmine.createSpyObj<VenueService>('VenueService', ['submitSuggestion']);
    const router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    venueService.submitSuggestion.and.returnValue(of({ id: 8, status: 'PENDING' }));

    const component = new VenueCreateComponent(venueService, router);
    component.environmentType = 'OUTDOOR';
    component.name = 'Pavilhão Central';
    component.city = 'Lisboa';
    component.address = 'Rua do Desporto';
    component.selectedSports = ['Futsal'];
    component.toilets = true;
    component.lockers = false;

    component.save();

    expect(venueService.submitSuggestion).toHaveBeenCalledOnceWith(jasmine.objectContaining({
      toilets: true,
      lockers: false,
      accessible: null,
      firstAid: null,
      aed: null,
      medicalStation: null,
      lifeguard: null,
      staffOnSite: null,
      securitySurveillance: null,
      cafe: null,
      restaurant: null,
      vendingMachines: null,
      sportsShop: null,
      wifi: null,
      phoneCharging: null,
      freeParking: null,
      nearbyRadiusMeters: 500,
      nearbyPharmacy: null,
      nearbyAtm: null
    }));
  });
});
