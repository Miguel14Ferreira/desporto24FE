import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';

import { VenueService } from '../../services/venue.service';
import { Venue } from '../model/venue';
import { VenueCreateComponent } from './venue-create.component';

describe('VenueCreateComponent', () => {
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
