import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';

import { VenueService } from '../../services/venue.service';
import { Venue } from '../model/venue';
import { VenueCreateComponent } from './venue-create.component';

describe('VenueCreateComponent', () => {
  it('prefills a valid favorite sport and locality from Discover without auto-saving', () => {
    const venueService = jasmine.createSpyObj<VenueService>('VenueService', ['create']);
    const router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    const route = {
      snapshot: { queryParamMap: convertToParamMap({ sport: '  pAdEl  ', city: '  Lisboa  ' }) }
    } as unknown as ActivatedRoute;
    const component = new VenueCreateComponent(venueService, router, route);
    component.ngOnInit();

    expect(component.city).toBe('Lisboa');
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
    expect(venueService.create).not.toHaveBeenCalled();
  });

  it('rejects an unknown sport without losing the locality passed from Discover', () => {
    const venueService = jasmine.createSpyObj<VenueService>('VenueService', ['create']);
    const router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    const route = {
      snapshot: { queryParamMap: convertToParamMap({ sport: 'Outro desporto', city: 'Porto' }) }
    } as unknown as ActivatedRoute;
    const component = new VenueCreateComponent(venueService, router, route);
    component.ngOnInit();

    expect(component.selectedSports).toEqual([]);
    expect(component.city).toBe('Porto');
  });

  it('uses bounded autocomplete only after the user explicitly asks to check for duplicates', () => {
    const service = jasmine.createSpyObj<VenueService>('VenueService', ['create', 'suggest']);
    const router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    service.suggest.and.returnValue(of({
      venues: [{ id: 33, name: 'Pavilhão Norte', city: 'Cascais' } as Venue],
      page: 0, hasMore: false
    }));
    const component = new VenueCreateComponent(service, router);
    component.name = 'Pavilhão';
    component.city = 'Cascais';

    expect(service.suggest).not.toHaveBeenCalled();
    component.checkSimilarVenues();

    expect(service.suggest).toHaveBeenCalledOnceWith('Pavilhão', 'Cascais', undefined, 0);
    expect(component.similarVenueCheckComplete).toBeTrue();
    expect(component.similarVenues.map(venue => venue.id)).toEqual([33]);
    expect(component.checkingSimilarVenues).toBeFalse();
    expect(service.create).not.toHaveBeenCalled();
  });

  it('ignores a stale autocomplete response after the name or city changes', () => {
    const service = jasmine.createSpyObj<VenueService>('VenueService', ['create', 'suggest']);
    const router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    const oldRequest = new Subject<{ venues: Venue[]; page: number; hasMore: boolean }>();
    service.suggest.and.returnValue(oldRequest.asObservable());
    const component = new VenueCreateComponent(service, router);
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
    const service = jasmine.createSpyObj<VenueService>('VenueService', ['create', 'suggest']);
    const router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    service.suggest.and.returnValue(throwError(() => new Error('search unavailable')));
    service.create.and.returnValue(of({ id: 8 } as Venue));
    const component = new VenueCreateComponent(service, router);
    component.name = 'Campo Novo';
    component.city = 'Lisboa';
    component.address = 'Rua Nova';
    component.selectedSports = ['Futsal'];

    component.checkSimilarVenues();
    expect(component.similarVenueCheckError).toBeTrue();
    expect(component.checkingSimilarVenues).toBeFalse();
    component.save();

    expect(service.create).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/menu/venues', 8]);
  });

  it('does not submit when required fields are missing', () => {
    const venueService = jasmine.createSpyObj<VenueService>('VenueService', ['create']);
    const router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    const component = new VenueCreateComponent(venueService, router);

    component.name = 'Pavilhão Central';
    component.city = '';
    component.address = 'Rua do Desporto';

    component.save();

    expect(venueService.create).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(component.validationError).toBeTrue();
    expect(component.saving).toBeFalse();
  });

  it('requires a selected sport before creating a venue', () => {
    const venueService = jasmine.createSpyObj<VenueService>('VenueService', ['create']);
    const router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    venueService.create.and.returnValue(of({ id: 9 } as Venue));
    const component = new VenueCreateComponent(venueService, router);
    component.name = 'Pavilhão Central';
    component.city = 'Lisboa';
    component.address = 'Rua do Desporto';

    component.save();

    expect(component.validationError).toBeTrue();
    expect(component.saving).toBeFalse();
    expect(venueService.create).not.toHaveBeenCalled();

    component.toggleSport('Padel', true);
    component.save();

    expect(component.validationError).toBeFalse();
    expect(venueService.create).toHaveBeenCalledOnceWith(
      jasmine.objectContaining({ sports: 'Padel' })
    );
    expect(router.navigate).toHaveBeenCalledWith(['/menu/venues', 9]);
  });

  it('creates the venue and navigates to its detail page', () => {
    const venueService = jasmine.createSpyObj<VenueService>('VenueService', ['create']);
    const router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    const venue = { id: 7, name: 'Pavilhão Central' } as Venue;
    venueService.create.and.returnValue(of(venue));

    const component = new VenueCreateComponent(venueService, router);
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

    expect(venueService.create).toHaveBeenCalledOnceWith(jasmine.objectContaining({
      name: 'Pavilhão Central', city: 'Lisboa', address: 'Rua do Desporto',
      sports: 'Futsal;Padel', environmentType: 'BOTH', indoor: true,
      website: 'https://pavilhao.example', contact: '+351 210 000 000', changingRooms: true, changingRoomTypes: 'MALE;FEMALE;ADAPTED', showers: true, stands: true, drinkingFountain: true, medicalStation: true, lifeguard: true, staffOnSite: true, securitySurveillance: true, restaurant: true, vendingMachines: true, sportsShop: true, wifi: true, phoneCharging: true, parking: true, freeParking: true, nearbyRadiusMeters: 1000, nearbyPharmacy: true, nearbyAtm: true, latitude: null, longitude: null
    }));
    expect(router.navigate).toHaveBeenCalledOnceWith(['/menu/venues', 7]);
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
      const venueService = jasmine.createSpyObj<VenueService>('VenueService', ['create']);
      const router = jasmine.createSpyObj<Router>('Router', ['navigate']);
      venueService.create.and.returnValue(of({ id: 7 } as Venue));

      const component = new VenueCreateComponent(venueService, router);
      component.name = 'Recinto de teste';
      component.city = 'Lisboa';
      component.address = 'Rua do Desporto';
      component.selectedSports = ['Futsal'];
      component.environmentType = environment;

      component.save();

      expect(venueService.create).toHaveBeenCalledOnceWith(
        jasmine.objectContaining({ environmentType: environment, indoor })
      );
    }
  });

  it('adds and removes sports from the multi-selection', () => {
    const venueService = jasmine.createSpyObj<VenueService>('VenueService', ['create']);
    const router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    const component = new VenueCreateComponent(venueService, router);

    component.toggleSport('Futsal', true);
    component.toggleSport('Padel', true);
    component.toggleSport('Futsal', false);

    expect(component.selectedSports).toEqual(['Padel']);
    expect(component.isSportSelected('Padel')).toBeTrue();
    expect(component.isSportSelected('Futsal')).toBeFalse();
  });

  it('starts with eight popular sports and gives access to the whole catalog', () => {
    const service = jasmine.createSpyObj<VenueService>('VenueService', ['create']);
    const router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    const component = new VenueCreateComponent(service, router);

    expect(component.visibleSports).toEqual([
      'Futebol', 'Futsal', 'Padel', 'Ténis',
      'Basquetebol', 'Natação', 'Voleibol', 'Musculação'
    ]);

    component.showAllSports = true;
    expect(component.visibleSports).toEqual([...component.sportsCatalog]);
  });

  it('searches all sports without accents and preserves multiple selections', () => {
    const service = jasmine.createSpyObj<VenueService>('VenueService', ['create']);
    const router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    const component = new VenueCreateComponent(service, router);

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
    const venueService = jasmine.createSpyObj<VenueService>('VenueService', ['create']);
    const router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    venueService.create.and.returnValue(throwError(() => new Error('create failed')));

    const component = new VenueCreateComponent(venueService, router);
    component.name = 'Pavilhão Central';
    component.city = 'Lisboa';
    component.address = 'Rua do Desporto';
    component.selectedSports = ['Futsal'];

    component.save();

    expect(venueService.create).toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(component.saveError).toBeTrue();
    expect(component.saving).toBeFalse();
  });
  it('fills coordinates from the current location', () => {
    const venueService = jasmine.createSpyObj<VenueService>('VenueService', ['create']);
    const router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    const component = new VenueCreateComponent(venueService, router);
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
    const venueService = jasmine.createSpyObj<VenueService>('VenueService', ['create']);
    const router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    const component = new VenueCreateComponent(venueService, router);
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
    const venueService = jasmine.createSpyObj<VenueService>('VenueService', ['create']);
    const router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    venueService.create.and.returnValue(of({ id: 8 } as Venue));

    const component = new VenueCreateComponent(venueService, router);
    component.name = 'Pavilhão Central';
    component.city = 'Lisboa';
    component.address = 'Rua do Desporto';
    component.selectedSports = ['Futsal'];
    component.toilets = true;
    component.lockers = false;

    component.save();

    expect(venueService.create).toHaveBeenCalledOnceWith(jasmine.objectContaining({
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
