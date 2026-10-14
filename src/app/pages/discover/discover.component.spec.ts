import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';

import { DiscoverComponent } from './discover.component';
import { TEST_IMPORTS, TEST_PROVIDERS } from '../../testing/test-providers';
import { CommunityService } from '../../services/community.service';
import { SessionService } from '../../services/session.service';
import { VenueService } from '../../services/venue.service';
import { CommunityProfile } from '../model/community-profile';

describe('DiscoverComponent', () => {
  let component: DiscoverComponent;
  let fixture: ComponentFixture<DiscoverComponent>;
  let venueService: jasmine.SpyObj<VenueService>;
  let sessionService: jasmine.SpyObj<SessionService>;
  let communityService: jasmine.SpyObj<CommunityService>;

  beforeEach(async () => {
    venueService = jasmine.createSpyObj<VenueService>('VenueService', ['search']);
    sessionService = jasmine.createSpyObj<SessionService>('SessionService', ['discover']);
    communityService = jasmine.createSpyObj<CommunityService>(
      'CommunityService',
      ['publicProfile', 'findProfiles', 'discoverProfiles']
    );

    venueService.search.and.returnValue(of([]));
    sessionService.discover.and.returnValue(of([]));
    communityService.publicProfile.and.returnValue(of({
      username: 'miguel',
      fullName: 'Miguel',
      nickname: null,
      country: 'Portugal',
      location: 'Lisboa',
      favoriteSports: 'Padel, Futebol',
      bio: null,
      skillLevel: 'INTERMEDIATE',
      availability: null,
      age: 37,
      profilePicUrl: null,
      joinDateDisplay: null
    }));
    communityService.findProfiles.and.returnValue(of([]));
    communityService.discoverProfiles.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      declarations: [DiscoverComponent],
      imports: TEST_IMPORTS,
      providers: [
        ...TEST_PROVIDERS,
        { provide: VenueService, useValue: venueService },
        { provide: SessionService, useValue: sessionService },
        { provide: CommunityService, useValue: communityService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DiscoverComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('prefills sport and locality from the profile and uses both when searching', () => {
    expect(component.sport).toBe('Padel');
    expect(component.location).toBe('Lisboa');
    expect(venueService.search).toHaveBeenCalledWith('Lisboa', 'Padel');
    expect(sessionService.discover).toHaveBeenCalledWith(
      jasmine.objectContaining({
        sport: 'Padel',
        city: 'Lisboa',
        availability: 'available'
      })
    );
    expect(communityService.findProfiles).toHaveBeenCalledWith({
      sport: 'Padel',
      location: 'Lisboa'
    });
    const locality: HTMLInputElement = fixture.nativeElement.querySelector('input[name="location"]');
    expect(locality.value).toBe('Lisboa');
  });

  it('keeps manually entered filters if the profile arrives after editing', () => {
    const delayedProfile = new Subject<CommunityProfile>();
    communityService.publicProfile.and.returnValue(delayedProfile.asObservable());
    const page = TestBed.createComponent(DiscoverComponent);
    page.detectChanges();

    // Simulate the values emitted by the form without waiting for the deliberately pending profile.
    page.componentInstance.onSportChange('Ténis');
    page.componentInstance.onLocationChange('Sintra');

    expect(page.componentInstance.sport).toBe('Ténis');
    expect(page.componentInstance.location).toBe('Sintra');

    delayedProfile.next({
      username: 'miguel', fullName: 'Miguel', nickname: null,
      country: 'Portugal', location: 'Lisboa', favoriteSports: 'Padel, Futebol',
      bio: null, skillLevel: null, availability: null, age: 37,
      profilePicUrl: null, joinDateDisplay: null
    });
    delayedProfile.complete();

    expect(page.componentInstance.sport).toBe('Ténis');
    expect(page.componentInstance.location).toBe('Sintra');
    expect(venueService.search).toHaveBeenCalledWith('Sintra', 'Ténis');
    page.destroy();
  });

  it('uses only sports from the catalog when suggesting a favorite', () => {
    communityService.publicProfile.and.returnValue(of({
      username: 'miguel', fullName: 'Miguel', nickname: null,
      country: 'Portugal', location: '  Porto  ', favoriteSports: 'Not a sport, pAdEl',
      bio: null, skillLevel: null, availability: null, age: 37,
      profilePicUrl: null, joinDateDisplay: null
    }));
    const page = TestBed.createComponent(DiscoverComponent);
    page.detectChanges();

    expect(page.componentInstance.sport).toBe('Padel');
    expect(page.componentInstance.location).toBe('Porto');
    expect(venueService.search).toHaveBeenCalledWith('Porto', 'Padel');
    page.destroy();
  });

  it('keeps discovery broad when the profile has no preferences', () => {
    communityService.publicProfile.and.returnValue(of({
      username: 'miguel', fullName: 'Miguel', nickname: null,
      country: 'Portugal', location: null, favoriteSports: null,
      bio: null, skillLevel: null, availability: null, age: 37,
      profilePicUrl: null, joinDateDisplay: null
    }));
    const page = TestBed.createComponent(DiscoverComponent);
    page.detectChanges();

    expect(page.componentInstance.sport).toBe('');
    expect(page.componentInstance.location).toBe('');
    expect(venueService.search).toHaveBeenCalledWith(undefined, undefined);
    page.destroy();
  });

  it('searches nearby venues by device position without changing sessions or people', () => {
    const original = Object.getOwnPropertyDescriptor(navigator, 'geolocation');
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (success: PositionCallback) =>
          success({ coords: { latitude: 38.72, longitude: -9.14 } } as unknown as GeolocationPosition)
      }
    });
    try {
      component.enableNearbyVenues();
      expect(component.nearbyVenuePosition).toEqual({ latitude: 38.72, longitude: -9.14 });
      expect(venueService.search).toHaveBeenCalledWith(undefined, 'Padel', 38.72, -9.14, 25);
      expect(sessionService.discover).toHaveBeenCalledWith(jasmine.objectContaining({
        city: 'Lisboa', latitude: undefined, radiusKm: undefined, sort: 'date'
      }));
      expect(communityService.findProfiles).toHaveBeenCalledWith({
        sport: 'Padel', location: 'Lisboa'
      });
    } finally {
      if (original) {
        Object.defineProperty(navigator, 'geolocation', original);
      } else {
        delete (navigator as any).geolocation;
      }
    }
  });

  it('updates nearby venue radius and restores city filtering when the location changes', () => {
    component.nearbyVenuePosition = { latitude: 38.72, longitude: -9.14 };
    component.changeNearbyVenueRadius(50);
    expect(venueService.search).toHaveBeenCalledWith(undefined, 'Padel', 38.72, -9.14, 50);

    component.onLocationChange('Sintra');
    component.search();
    expect(component.nearbyVenuePosition).toBeNull();
    expect(venueService.search).toHaveBeenCalledWith('Sintra', 'Padel');
  });

  it('keeps the normal venue search when location permission is denied', () => {
    const original = Object.getOwnPropertyDescriptor(navigator, 'geolocation');
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (_success: PositionCallback, error: PositionErrorCallback) =>
          error({} as unknown as GeolocationPositionError)
      }
    });
    try {
      component.enableNearbyVenues();
      fixture.detectChanges();
      expect(component.nearbyVenuePosition).toBeNull();
      expect(component.nearbyVenueError).toBe('unavailable');
      expect(fixture.nativeElement.querySelector('.discover-nearby--venues [role="alert"]')).not.toBeNull();
      expect(venueService.search).toHaveBeenCalledWith('Lisboa', 'Padel');
    } finally {
      if (original) {
        Object.defineProperty(navigator, 'geolocation', original);
      } else {
        delete (navigator as any).geolocation;
      }
    }
  });

  it('ignores a late venue GPS response after the user edits their locality', () => {
    const original = Object.getOwnPropertyDescriptor(navigator, 'geolocation');
    let resolvePosition: PositionCallback | undefined;
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition: (success: PositionCallback) => { resolvePosition = success; } }
    });
    try {
      component.enableNearbyVenues();
      component.onLocationChange('Sintra');
      resolvePosition?.({ coords: { latitude: 38.72, longitude: -9.14 } } as unknown as GeolocationPosition);
      expect(component.nearbyVenuePosition).toBeNull();
      expect(component.locatingVenues).toBeFalse();
    } finally {
      if (original) {
        Object.defineProperty(navigator, 'geolocation', original);
      } else {
        delete (navigator as any).geolocation;
      }
    }
  });

  it('uses the requested device position for nearby sessions only', () => {
    const original = Object.getOwnPropertyDescriptor(navigator, 'geolocation');
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (success: PositionCallback) => {
          success({ coords: { latitude: 38.72, longitude: -9.14 } } as unknown as GeolocationPosition);
        }
      }
    });
    try {
      component.enableNearbySessions();
      expect(component.nearbyPosition).toEqual({ latitude: 38.72, longitude: -9.14 });
      expect(sessionService.discover).toHaveBeenCalledWith(jasmine.objectContaining({
        sport: 'Padel', city: undefined, latitude: 38.72, longitude: -9.14,
        radiusKm: 25, sort: 'distance'
      }));
      expect(venueService.search).toHaveBeenCalledWith('Lisboa', 'Padel');
      expect(communityService.findProfiles).toHaveBeenCalledWith({ sport: 'Padel', location: 'Lisboa' });
    } finally {
      if (original) {
        Object.defineProperty(navigator, 'geolocation', original);
      } else {
        delete (navigator as any).geolocation;
      }
    }
  });

  it('updates nearby radius and reverts to city search when locality is edited', () => {
    component.nearbyPosition = { latitude: 38.72, longitude: -9.14 };
    component.changeNearbyRadius(50);
    expect(sessionService.discover).toHaveBeenCalledWith(jasmine.objectContaining({
      radiusKm: 50, sort: 'distance', city: undefined
    }));
    component.onLocationChange('Sintra');
    component.search();
    expect(component.nearbyPosition).toBeNull();
    expect(sessionService.discover).toHaveBeenCalledWith(jasmine.objectContaining({
      city: 'Sintra', latitude: undefined, longitude: undefined,
      radiusKm: undefined, sort: 'date'
    }));
  });

  it('does not enable nearby mode when location permission is denied', () => {
    const original = Object.getOwnPropertyDescriptor(navigator, 'geolocation');
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition: (_success: PositionCallback, error: PositionErrorCallback) => error({} as unknown as GeolocationPositionError) }
    });
    try {
      component.enableNearbySessions();
      fixture.detectChanges();
      expect(component.nearbyPosition).toBeNull();
      expect(component.nearbySessionError).toBe('unavailable');
      expect(fixture.nativeElement.querySelector('.discover-nearby [role="alert"]')).not.toBeNull();
      expect(sessionService.discover).not.toHaveBeenCalledWith(jasmine.objectContaining({ sort: 'distance' }));
    } finally {
      if (original) {
        Object.defineProperty(navigator, 'geolocation', original);
      } else {
        delete (navigator as any).geolocation;
      }
    }
  });

  it('ignores a late GPS result after the locality was changed', () => {
    const original = Object.getOwnPropertyDescriptor(navigator, 'geolocation');
    let resolvePosition: PositionCallback | undefined;
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition: (success: PositionCallback) => { resolvePosition = success; } }
    });
    try {
      component.enableNearbySessions();
      component.onLocationChange('Sintra');
      resolvePosition?.({ coords: { latitude: 38.72, longitude: -9.14 } } as unknown as GeolocationPosition);
      expect(component.nearbyPosition).toBeNull();
      expect(component.locatingSessions).toBeFalse();
    } finally {
      if (original) {
        Object.defineProperty(navigator, 'geolocation', original);
      } else {
        delete (navigator as any).geolocation;
      }
    }
  });

  it('opens discovered people directly in their public profiles', () => {
    const profile = {
      username: 'teammate',
      fullName: 'Teammate',
      nickname: null,
      country: 'Portugal',
      location: 'Lisboa',
      favoriteSports: 'Padel',
      bio: null,
      skillLevel: null,
      availability: null,
      age: 28,
      profilePicUrl: null,
      joinDateDisplay: null
    };
    component.people = [profile];
    component.topPeopleResults = [profile];
    component.initialized = true;
    fixture.detectChanges();

    const link: HTMLAnchorElement | null = fixture.nativeElement.querySelector('.person-card');
    expect(link?.getAttribute('href')).toBe('/menu/perfis/teammate');
    expect(link?.textContent).toContain('Teammate');
  });

  it('should calculate session vacancies', () => {
    expect(component.vacancies({
      id: 1,
      sport: 'Padel',
      city: 'Lisboa',
      gameDate: '2026-10-01T18:00:00Z',
      distanceKm: null,
      participantCount: 6,
      maxParticipants: 8,
      priceAmount: 5,
      privateGame: false,
      status: 'OPEN'
    })).toBe(2);
  });
  it('collapses expanded venue results when starting a new search', () => {
    component.showAllVenues = true;
    component.search();
    expect(component.showAllVenues).toBeFalse();
  });

  it('expands and collapses venue results', () => {
    const venues = Array.from({ length: 6 }, (_, index) => ({
      id: index + 1
    } as any));
    venueService.search.and.returnValue(of(venues));
    component.search();

    expect(component.venues).toEqual(venues);
    expect(component.topVenues.length).toBe(4);

    component.toggleAllVenues();
    expect(component.topVenues.length).toBe(6);

    component.toggleAllVenues();
    expect(component.topVenues.length).toBe(4);
  });

  it('should show an availability error when a discover request still fails after retry', () => {
    venueService.search.and.returnValue(
      throwError(() => new Error('API unavailable'))
    );

    component.search();

    expect(venueService.search).toHaveBeenCalled();
    expect(component.loadError).toBeTrue();
    expect(component.initialized).toBeTrue();
  });

  it('should clear the availability error when a retry search succeeds', () => {
    venueService.search.and.returnValue(
      throwError(() => new Error('API unavailable'))
    );
    component.search();
    expect(component.loadError).toBeTrue();

    venueService.search.and.returnValue(of([]));
    component.search();

    expect(component.loadError).toBeFalse();
  });
});
