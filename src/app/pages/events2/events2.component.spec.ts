import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
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
    venueService = jasmine.createSpyObj<VenueService>('VenueService', ['search', 'create', 'listPhotos']);
    venueService.search.and.returnValue(of([]));
    venueService.listPhotos.and.returnValue(of([]));

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

  it('keeps the normal session-creation flow unchanged', () => {
    expect(component.findPlayersMode).toBeFalse();
    expect(fixture.nativeElement.querySelector('.page-header h1')?.textContent)
      .toContain('Criar uma sessão');
    expect(fixture.nativeElement.querySelector('input[name="privateGame"]')).not.toBeNull();
  });

  it('opens Find Players mode and creates a public session even if private state was set', () => {
    const route = TestBed.inject(ActivatedRoute);
    spyOn(route.snapshot.queryParamMap, 'get')
      .and.callFake(name => name === 'intent' ? 'findPlayers' : null);
    fixture.detectChanges();

    expect(component.findPlayersMode).toBeTrue();
    expect(fixture.nativeElement.querySelector('.page-header h1')?.textContent)
      .toContain('Encontrar jogadores');
    expect(fixture.nativeElement.querySelector('.recruit-context')?.textContent)
      .toContain('total de jogadores');
    expect(fixture.nativeElement.querySelector('input[name="privateGame"]')).toBeNull();

    component.sport = 'Padel';
    component.gameDate = '2099-10-15T18:00';
    component.city = 'Lisboa';
    component.address = 'Rua do Campo';
    component.maxParticipants = 10;
    component.privateGame = true;
    component.password = '';

    component.createSession();

    expect(sessionService.create).toHaveBeenCalledWith(
      jasmine.objectContaining({
        privateGame: false,
        password: null,
        maxParticipants: 10
      }),
      undefined
    );
  });

  it('advertises exactly two places for eight confirmed players out of ten', () => {
    const route = TestBed.inject(ActivatedRoute);
    spyOn(route.snapshot.queryParamMap, 'get')
      .and.callFake(name => name === 'intent' ? 'findPlayers' : null);
    fixture.detectChanges();

    component.sport = 'Padel';
    component.gameDate = '2099-10-15T18:00';
    component.city = 'Lisboa';
    component.address = 'Rua do Campo';
    component.maxParticipants = 10;
    component.confirmedPlayers = 8;
    fixture.detectChanges();

    expect(component.availablePlaces).toBe(2);
    expect(fixture.nativeElement.querySelector('input[name="confirmedPlayers"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.recruit-remaining strong')?.textContent?.trim()).toBe('2');

    component.createSession();
    expect(sessionService.create).toHaveBeenCalledWith(
      jasmine.objectContaining({
        maxParticipants: 10,
        externalConfirmedParticipants: 7,
        privateGame: false
      }),
      undefined
    );
  });

  it('blocks invalid confirmed-player totals in Find Players mode', () => {
    const route = TestBed.inject(ActivatedRoute);
    spyOn(route.snapshot.queryParamMap, 'get')
      .and.callFake(name => name === 'intent' ? 'findPlayers' : null);
    component.sport = 'Padel';
    component.gameDate = '2099-10-15T18:00';
    component.city = 'Lisboa';
    component.address = 'Rua do Campo';
    component.maxParticipants = 10;

    for (const invalid of [0, 11, 2.5, null]) {
      component.confirmedPlayers = invalid;
      component.createSession();
      expect(sessionService.create).not.toHaveBeenCalled();
      expect(component.errorMessage).toContain('confirmados');
    }
  });

  it('does not send external confirmations from normal session creation', () => {
    component.sport = 'Padel';
    component.gameDate = '2099-10-15T18:00';
    component.city = 'Lisboa';
    component.address = 'Rua do Campo';
    component.maxParticipants = 10;

    component.createSession();

    const request = sessionService.create.calls.mostRecent().args[0];
    expect(request.externalConfirmedParticipants).toBeUndefined();
    expect(fixture.nativeElement.querySelector('input[name="confirmedPlayers"]')).toBeNull();
  });

  it('should reject an incomplete session', () => {
    component.createSession();

    expect(sessionService.create).not.toHaveBeenCalled();
    expect(component.errorMessage).toBe('Seleciona um desporto da lista.');
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
      venueType: 'Pavilhão',
      ownershipType: 'PUBLIC',
      surfaceType: 'Madeira',
      environmentType: 'INDOOR',
      indoor: true,
      changingRooms: true,
      changingRoomTypes: null,
      toilets: null,
      lockers: null,
      showers: null,
      stands: null,
      drinkingFountain: null,
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
      latitude: 38.72,
      longitude: -9.14,
      informationSource: 'COMMUNITY',
      createdByUsername: 'fixture-user',
      createdAt: '2026-10-13T00:00:00Z'
    }];

    component.selectVenue(5);

    expect(component.selectedVenueId).toBe(5);
    expect(component.city).toBe('Lisboa');
    expect(component.address).toBe('Rua do Desporto 10');
    expect(component.locationCaptured).toBeTrue();
  });

  it('should reject an invalid recurring session occurrence count', () => {
    component.sport = 'Padel';
    component.gameDate = '2099-10-15T18:00';
    component.city = 'Lisboa';
    component.address = 'Rua do Campo';
    component.maxParticipants = 4;
    component.communityId = 12;
    component.recurrence = 'WEEKLY';
    component.recurrenceOccurrences = 1;

    component.createSession();

    expect(sessionService.create).not.toHaveBeenCalled();
    expect(component.errorMessage).toContain('2');
    expect(component.errorMessage).toContain('52');
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
