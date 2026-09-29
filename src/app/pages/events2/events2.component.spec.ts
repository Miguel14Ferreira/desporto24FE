import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';

import { Events2Component } from './events2.component';
import { SessionService } from '../../services/session.service';
import { VenueService } from '../../services/venue.service';
import { TEST_IMPORTS, TEST_PROVIDERS } from '../../testing/test-providers';

describe('Events2Component', () => {
  let component: Events2Component;
  let fixture: ComponentFixture<Events2Component>;
  let sessionService: jasmine.SpyObj<SessionService>;
  let venueService: jasmine.SpyObj<VenueService>;
  let router: Router;

  beforeEach(async () => {
    sessionService = jasmine.createSpyObj<SessionService>('SessionService', ['create']);
    venueService = jasmine.createSpyObj<VenueService>('VenueService', ['search', 'create']);
    venueService.search.and.returnValue(of([]));

    sessionService.create.and.returnValue(of({
      id: 42,
      sport: 'Padel',
      city: 'Lisboa',
      gameDate: '2026-10-15T18:00:00Z',
      distanceKm: null,
      participantCount: 1,
      maxParticipants: 4,
      priceAmount: 0,
      privateGame: false,
      status: 'OPEN',
      creatorUsername: 'fixture-user',
      address: 'Rua do Campo',
      canSeeExactAddress: true,
      joined: true,
      waitlisted: false,
      waitlistPosition: null,
      gamePhoto: null
    }));

    await TestBed.configureTestingModule({
      declarations: [Events2Component],
      imports: TEST_IMPORTS,
      providers: [
        ...TEST_PROVIDERS,
        { provide: SessionService, useValue: sessionService },
        { provide: VenueService, useValue: venueService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(Events2Component);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.returnValue(Promise.resolve(true));
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should reject an incomplete session', () => {
    component.createSession();

    expect(sessionService.create).not.toHaveBeenCalled();
    expect(component.errorMessage).toContain('Preenche');
  });

  it('should create a session through the new API and navigate to its details', () => {
    component.sport = 'Padel';
    component.gameDate = '2099-10-15T18:00';
    component.city = 'Lisboa';
    component.address = 'Rua do Campo';
    component.maxParticipants = 4;

    component.createSession();

    expect(sessionService.create).toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/menu/events', 42]);
  });

  it('should include captured coordinates when creating a session', () => {
    component.sport = 'Padel';
    component.gameDate = '2099-10-15T18:00';
    component.city = 'Lisboa';
    component.address = 'Rua do Campo';
    component.maxParticipants = 4;
    component.locationCaptured = true;
    component.latitude = 38.72;
    component.longitude = -9.14;

    component.createSession();

    expect(sessionService.create).toHaveBeenCalledWith(
      jasmine.objectContaining({
        latitude: 38.72,
        longitude: -9.14
      }),
      undefined
    );
  });

  it('should apply a saved venue to the session form', () => {
    component.venues = [{
      id: 5,
      name: 'Pavilhão Central',
      city: 'Lisboa',
      address: 'Rua do Desporto 10',
      sports: 'Futsal',
      surfaceType: 'Madeira',
      indoor: true,
      changingRooms: true,
      parking: true,
      lighting: true,
      latitude: 38.72,
      longitude: -9.14,
      createdByUsername: 'fixture-user'
    }];

    component.selectVenue(5);

    expect(component.selectedVenueId).toBe(5);
    expect(component.city).toBe('Lisboa');
    expect(component.address).toBe('Rua do Desporto 10');
    expect(component.locationCaptured).toBeTrue();
  });

  it('should require a password when the session is private', () => {
    component.sport = 'Padel';
    component.gameDate = '2099-10-15T18:00';
    component.city = 'Lisboa';
    component.address = 'Rua do Campo';
    component.maxParticipants = 4;
    component.privateGame = true;

    component.createSession();

    expect(sessionService.create).not.toHaveBeenCalled();
    expect(component.errorMessage).toContain('palavra-passe');
  });
});
