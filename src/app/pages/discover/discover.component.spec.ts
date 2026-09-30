import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

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

  it('should prefill discovery from the sports profile', () => {
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
  it('expands and collapses venue results', () => {
    component.venues = Array.from({ length: 6 }, (_, index) => ({
      id: index + 1
    } as any));

    expect(component.topVenues.length).toBe(4);

    component.toggleAllVenues();
    expect(component.topVenues.length).toBe(6);

    component.toggleAllVenues();
    expect(component.topVenues.length).toBe(4);
  });
});
