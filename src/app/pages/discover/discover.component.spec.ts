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

  it('keeps manually entered filters if the profile arrives after editing', async () => {
    const delayedProfile = new Subject<CommunityProfile>();
    communityService.publicProfile.and.returnValue(delayedProfile.asObservable());
    const page = TestBed.createComponent(DiscoverComponent);
    page.detectChanges();
    // Wait for NgModel to initialise before simulating actual user input.
    await page.whenStable();
    page.detectChanges();

    const sportInput: HTMLInputElement = page.nativeElement.querySelector('input[name="sport"]');
    const localityInput: HTMLInputElement = page.nativeElement.querySelector('input[name="location"]');
    sportInput.value = 'Ténis';
    sportInput.dispatchEvent(new Event('input'));
    localityInput.value = 'Sintra';
    localityInput.dispatchEvent(new Event('input'));
    await page.whenStable();
    page.detectChanges();

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
