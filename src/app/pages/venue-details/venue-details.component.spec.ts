import { ActivatedRoute } from '@angular/router';
import { of, throwError } from 'rxjs';

import { VenueService } from '../../services/venue.service';
import { Venue } from '../model/venue';
import { VenueDetailsComponent } from './venue-details.component';

describe('VenueDetailsComponent', () => {
  it('loads the venue, photos and sport conditions from the route id', () => {
    const venue: Venue = {
      id: 7,
      name: 'Pavilhão Central',
      city: 'Lisboa',
      address: 'Rua do Desporto',
      sports: 'Futsal',
      venueType: 'Pavilhão',
      ownershipType: 'PUBLIC',
      surfaceType: 'Madeira',
      indoor: true,
      changingRooms: true,
      toilets: true,
      lockers: true,
      accessible: true,
      firstAid: true,
      aed: true,
      cafe: false,
      services: null,
      transport: null,
      openingHours: null,
      priceInfo: null,
      parking: true,
      lighting: true,
      latitude: 38.7223,
      longitude: -9.1393,
      informationSource: 'COMMUNITY',
      createdByUsername: 'miguel'
    };

    const route = {
      snapshot: {
        paramMap: {
          get: () => '7'
        }
      }
    } as unknown as ActivatedRoute;

    const venueService = jasmine.createSpyObj<VenueService>('VenueService', [
      'get',
      'listPhotos',
      'listSportConditions',
      'addPhoto',
      'addSportCondition'
    ]);

    venueService.get.and.returnValue(of(venue));
    venueService.listPhotos.and.returnValue(of([]));
    venueService.listSportConditions.and.returnValue(of([]));

    const component = new VenueDetailsComponent(route, venueService);

    component.ngOnInit();

    expect(venueService.get).toHaveBeenCalledOnceWith(7);
    expect(venueService.listPhotos).toHaveBeenCalledOnceWith(7);
    expect(venueService.listSportConditions).toHaveBeenCalledOnceWith(7);
    expect(component.venue).toEqual(venue);
    expect(component.loading).toBeFalse();
    expect(component.photosLoading).toBeFalse();
    expect(component.sportConditionsLoading).toBeFalse();
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
      'listPhotos',
      'listSportConditions',
      'addPhoto',
      'addSportCondition'
    ]);

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
    const venue: Venue = {
      id: 7,
      name: 'Pavilhão Central',
      city: 'Lisboa',
      address: 'Rua do Desporto',
      sports: 'Futsal',
      venueType: 'Pavilhão',
      ownershipType: 'PUBLIC',
      surfaceType: 'Madeira',
      indoor: true,
      changingRooms: true,
      toilets: true,
      lockers: true,
      accessible: true,
      firstAid: true,
      aed: true,
      cafe: false,
      services: null,
      transport: null,
      openingHours: null,
      priceInfo: null,
      parking: true,
      lighting: true,
      latitude: 38.7223,
      longitude: -9.1393,
      informationSource: 'COMMUNITY',
      createdByUsername: 'miguel'
    };

    const route = {
      snapshot: {
        paramMap: {
          get: () => '7'
        }
      }
    } as unknown as ActivatedRoute;

    const venueService = jasmine.createSpyObj<VenueService>('VenueService', [
      'get',
      'listPhotos',
      'listSportConditions',
      'addPhoto',
      'addSportCondition'
    ]);

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
    const venue: Venue = {
      id: 7,
      name: 'Pavilhão Central',
      city: 'Lisboa',
      address: 'Rua do Desporto',
      sports: 'Futsal',
      venueType: 'Pavilhão',
      ownershipType: 'PUBLIC',
      surfaceType: 'Madeira',
      indoor: true,
      changingRooms: true,
      toilets: true,
      lockers: true,
      accessible: true,
      firstAid: true,
      aed: true,
      cafe: false,
      services: null,
      transport: null,
      openingHours: null,
      priceInfo: null,
      parking: true,
      lighting: true,
      latitude: 38.7223,
      longitude: -9.1393,
      informationSource: 'COMMUNITY',
      createdByUsername: 'miguel'
    };

    const route = {
      snapshot: {
        paramMap: {
          get: () => '7'
        }
      }
    } as unknown as ActivatedRoute;

    const venueService = jasmine.createSpyObj<VenueService>('VenueService', [
      'get',
      'listPhotos',
      'listSportConditions',
      'addPhoto',
      'addSportCondition'
    ]);

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
    expect(component.loadError).toBeFalse();
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
});
