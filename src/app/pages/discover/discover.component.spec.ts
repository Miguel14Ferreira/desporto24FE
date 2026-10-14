import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { DiscoverComponent } from './discover.component';
import { TEST_IMPORTS, TEST_PROVIDERS } from '../../testing/test-providers';
import { CommunityService } from '../../services/community.service';
import { SessionService } from '../../services/session.service';
import { VenueService } from '../../services/venue.service';

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

  it('should prefill only the sport and ignore legacy profile location', () => {
    expect(component.sport).toBe('Padel');
    expect(component.location).toBe('');
    expect(venueService.search).toHaveBeenCalledWith(undefined, 'Padel');
    expect(sessionService.discover).toHaveBeenCalledWith(
      jasmine.objectContaining({
        sport: 'Padel',
        city: undefined,
        availability: 'available'
      })
    );
    expect(communityService.findProfiles).toHaveBeenCalledWith({
      sport: 'Padel',
      location: undefined
    });
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
