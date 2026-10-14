import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';

import { Events2Component } from './events2.component';
import { Venue } from '../model/venue';
import { SessionService } from '../../services/session.service';
import { VenuePhoto, VenueService } from '../../services/venue.service';
import { TEST_IMPORTS, TEST_PROVIDERS } from '../../testing/test-providers';

describe('Events2Component', () => {
  let component: Events2Component;
  let fixture: ComponentFixture<Events2Component>;
  let sessionService: jasmine.SpyObj<SessionService>;
  let venueService: jasmine.SpyObj<VenueService>;
  let router: Router;

  beforeEach(async () => {
    sessionService = jasmine.createSpyObj<SessionService>('SessionService', ['create']);
    venueService = jasmine.createSpyObj<VenueService>('VenueService', ['search', 'create', 'listPhotos', 'resolveMapLink']);
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

  it('waits for a newly created venue before submitting the session', () => {
    const pending = new Subject<Venue>();
    venueService.create.and.returnValue(pending.asObservable());
    component.sport = 'Padel';
    component.gameDate = '2099-10-15T18:00';
    component.city = 'Lisboa';
    component.address = 'Rua A';
    component.venueName = 'Campo Novo';

    component.saveVenue();
    fixture.detectChanges();

    const submit = fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(component.venueSaving).toBeTrue();
    expect(submit.disabled).toBeTrue();

    component.createSession();
    expect(sessionService.create).not.toHaveBeenCalled();

    pending.next({
      id: 303, name: 'Campo Novo', city: 'Lisboa',
      address: 'Rua A', sports: 'Padel', latitude: null, longitude: null
    } as Venue);
    pending.complete();
    fixture.detectChanges();

    expect(component.venueSaving).toBeFalse();
    expect(component.selectedVenueId).toBe(303);
    expect(submit.disabled).toBeFalse();

    component.createSession();
    expect(sessionService.create).toHaveBeenCalledWith(
      jasmine.objectContaining({ venueId: 303, sport: 'Padel' }),
      undefined
    );
  });

  it('re-enables session submission after venue creation fails', () => {
    const pending = new Subject<Venue>();
    venueService.create.and.returnValue(pending.asObservable());
    component.sport = 'Padel';
    component.gameDate = '2099-10-15T18:00';
    component.city = 'Lisboa';
    component.address = 'Rua A';
    component.venueName = 'Campo Novo';

    component.saveVenue();
    component.createSession();
    expect(sessionService.create).not.toHaveBeenCalled();

    pending.error(new Error('Service unavailable'));
    fixture.detectChanges();

    const submit = fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(component.venueSaving).toBeFalse();
    expect(submit.disabled).toBeFalse();

    component.createSession();
    expect(sessionService.create).toHaveBeenCalledTimes(1);
  });

  it('does not submit the same session twice while creation is pending', () => {
    const pending = new Subject<any>();
    sessionService.create.and.returnValue(pending.asObservable());
    component.sport = 'Padel';
    component.gameDate = '2099-10-15T18:00';
    component.city = 'Lisboa';
    component.address = 'Rua do Campo';

    component.createSession();
    component.createSession();

    expect(sessionService.create).toHaveBeenCalledTimes(1);
    expect(component.loading).toBeTrue();

    pending.error(new Error('Service unavailable'));
    expect(component.loading).toBeFalse();
  });

  it('allows session creation to be retried after a failed request', () => {
    const pending = new Subject<any>();
    sessionService.create.and.returnValue(pending.asObservable());
    component.sport = 'Padel';
    component.gameDate = '2099-10-15T18:00';
    component.city = 'Lisboa';
    component.address = 'Rua do Campo';

    component.createSession();
    pending.error(new Error('Service unavailable'));

    expect(component.loading).toBeFalse();
    component.createSession();

    expect(sessionService.create).toHaveBeenCalledTimes(2);
  });

  it('ignores late GPS success after switching to a venue and back', () => {
    let onSuccess: PositionCallback | undefined;
    spyOn(navigator.geolocation, 'getCurrentPosition').and.callFake(success => {
      onSuccess = success;
    });
    component.venues = [{
      id: 101, name: 'Pavilhão', city: 'Lisboa', address: 'Rua A',
      sports: 'Padel', latitude: 38.72, longitude: -9.14
    } as Venue];

    component.captureCurrentLocation();
    expect(component.locating).toBeTrue();

    component.selectVenue(101);
    component.selectVenue(null);
    expect(component.locating).toBeFalse();

    onSuccess!({
      coords: { latitude: 41.15, longitude: -8.61, accuracy: 30 }
    } as unknown as GeolocationPosition);

    expect(component.selectedVenueId).toBeNull();
    expect(component.hasCoordinates).toBeFalse();
    expect(component.latitude).toBeNull();
    expect(component.longitude).toBeNull();
    expect(component.locationSource).toBeNull();
    expect(component.locationError).toBe('');
  });

  it('does not show a stale GPS error after switching to a Maps link', () => {
    let onError: PositionErrorCallback | null | undefined;
    spyOn(navigator.geolocation, 'getCurrentPosition').and.callFake((_success, error) => {
      onError = error;
    });

    component.captureCurrentLocation();
    expect(component.locating).toBeTrue();

    component.onVenueMapLinkChanged('https://maps.app.goo.gl/new');
    expect(component.locating).toBeFalse();

    onError!({ code: 1, message: 'Permission denied' } as unknown as GeolocationPositionError);

    expect(component.venueMapLink).toBe('https://maps.app.goo.gl/new');
    expect(component.locationError).toBe('');
    expect(component.locationSource).toBeNull();
  });

  it('still accepts GPS coordinates from the current browser request', () => {
    let onSuccess: PositionCallback | undefined;
    spyOn(navigator.geolocation, 'getCurrentPosition').and.callFake(success => {
      onSuccess = success;
    });

    component.captureCurrentLocation();
    onSuccess!({
      coords: { latitude: 38.72, longitude: -9.14, accuracy: 24 }
    } as unknown as GeolocationPosition);

    expect(component.locating).toBeFalse();
    expect(component.locationSource).toBe('gps');
    expect(component.hasCoordinates).toBeTrue();
    expect(component.latitude).toBe(38.72);
    expect(component.longitude).toBe(-9.14);
    expect(component.gpsAccuracyMeters).toBe(24);
  });

  it('shows the browser-reported GPS accuracy and warns when it exceeds 100 metres', () => {
    component.applyCurrentPosition(38.72, -9.14, 245.7);
    fixture.detectChanges();

    expect(component.gpsAccuracyMeters).toBe(246);
    expect(component.gpsAccuracyIsLow).toBeTrue();

    const accuracy = fixture.nativeElement.querySelector('.gps-accuracy') as HTMLElement;
    expect(accuracy.textContent).toContain('246');
    expect(accuracy.textContent).toContain('aproximada');
    expect(accuracy.classList.contains('gps-accuracy-warning')).toBeTrue();
  });

  it('shows precise GPS estimates without warning and clears them on removal', () => {
    component.applyCurrentPosition(38.72, -9.14, 19.4);
    fixture.detectChanges();

    expect(component.gpsAccuracyMeters).toBe(19);
    expect(component.gpsAccuracyIsLow).toBeFalse();

    const accuracy = fixture.nativeElement.querySelector('.gps-accuracy') as HTMLElement;
    expect(accuracy.textContent).toContain('19');
    expect(accuracy.textContent).not.toContain('aproximada');

    component.clearLocation();
    fixture.detectChanges();
    expect(component.gpsAccuracyMeters).toBeNull();
    expect(fixture.nativeElement.querySelector('.gps-accuracy')).toBeNull();
  });

  it('ignores a delayed Maps success after the organiser removes the location', () => {
    const pending = new Subject<{ resolvedUrl: string; latitude: number; longitude: number }>();
    venueService.resolveMapLink.and.returnValue(pending.asObservable());
    component.venueMapLink = 'https://maps.app.goo.gl/old';
    component.resolveVenueMapLink();
    expect(component.venueMapLinkLoading).toBeTrue();

    component.clearLocation();
    expect(component.venueMapLinkLoading).toBeFalse();

    pending.next({
      resolvedUrl: 'https://www.google.com/maps/old',
      latitude: 38.72, longitude: -9.14
    });
    pending.complete();
    fixture.detectChanges();

    expect(component.hasCoordinates).toBeFalse();
    expect(component.latitude).toBeNull();
    expect(component.longitude).toBeNull();
    expect(component.venueMapCandidateResolvedUrl).toBe('');
    expect(component.venueMapLinkError).toBe('');
    expect(fixture.nativeElement.querySelector('.venue-create-card iframe')).toBeNull();
  });

  it('ignores a delayed Maps error after a saved venue is selected', () => {
    const pending = new Subject<{ resolvedUrl: string; latitude: number; longitude: number }>();
    venueService.resolveMapLink.and.returnValue(pending.asObservable());
    component.venueMapLink = 'https://maps.app.goo.gl/old';
    component.resolveVenueMapLink();

    component.venues = [{
      id: 101, name: 'Pavilhão', city: 'Lisboa', address: 'Rua A',
      sports: 'Padel', latitude: 38.72, longitude: -9.14
    } as Venue];
    component.selectVenue(101);
    pending.error(new Error('Old request timed out'));

    expect(component.selectedVenueId).toBe(101);
    expect(component.latitude).toBe(38.72);
    expect(component.longitude).toBe(-9.14);
    expect(component.venueMapLinkError).toBe('');
    expect(component.venueMapLinkLoading).toBeFalse();
  });

  it('keeps a newer Maps request loading when an older lookup finishes', () => {
    const first = new Subject<{ resolvedUrl: string; latitude: number; longitude: number }>();
    const second = new Subject<{ resolvedUrl: string; latitude: number; longitude: number }>();
    venueService.resolveMapLink.and.returnValues(first.asObservable(), second.asObservable());
    component.venueMapLink = 'https://maps.app.goo.gl/old';
    component.resolveVenueMapLink();

    component.onVenueMapLinkChanged('https://maps.app.goo.gl/new');
    component.resolveVenueMapLink();

    first.next({
      resolvedUrl: 'https://www.google.com/maps/old',
      latitude: 38.72, longitude: -9.14
    });
    first.complete();

    expect(component.venueMapLinkLoading).toBeTrue();
    expect(component.hasCoordinates).toBeFalse();
    expect(component.venueMapCandidateResolvedUrl).toBe('');

    second.next({
      resolvedUrl: 'https://www.google.com/maps/new',
      latitude: 41.15, longitude: -8.61
    });
    second.complete();

    expect(component.venueMapLinkLoading).toBeFalse();
    expect(component.locationSource).toBe('map');
    expect(component.latitude).toBe(41.15);
    expect(component.longitude).toBe(-8.61);
    expect(component.venueMapCandidateResolvedUrl).toBe('https://www.google.com/maps/new');
  });

  it('invalidates an old Maps location when the user edits its link', () => {
    venueService.resolveMapLink.and.returnValues(
      of({ resolvedUrl: 'https://www.google.com/maps/old', latitude: 38.72, longitude: -9.14 }),
      of({ resolvedUrl: 'https://www.google.com/maps/new', latitude: 38.71, longitude: -9.13 })
    );
    component.venueMapLink = 'https://maps.app.goo.gl/old';
    component.resolveVenueMapLink();
    fixture.detectChanges();

    expect(component.hasCoordinates).toBeTrue();
    expect(component.latitude).toBe(38.72);
    expect(fixture.nativeElement.querySelector('.venue-create-card iframe')).not.toBeNull();

    const linkInput = fixture.nativeElement.querySelector('input[name="venueMapLink"]') as HTMLInputElement;
    linkInput.value = 'https://maps.app.goo.gl/new';
    linkInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(component.venueMapLink).toBe('https://maps.app.goo.gl/new');
    expect(component.hasCoordinates).toBeFalse();
    expect(component.latitude).toBeNull();
    expect(component.longitude).toBeNull();
    expect(component.venueMapCandidateResolvedUrl).toBe('');
    expect(fixture.nativeElement.querySelector('.venue-create-card iframe')).toBeNull();

    component.sport = 'Padel';
    component.gameDate = '2099-10-15T18:00';
    component.city = 'Lisboa';
    component.address = '';
    component.createSession();
    expect(sessionService.create).not.toHaveBeenCalled();

    component.resolveVenueMapLink();
    expect(component.hasCoordinates).toBeTrue();
    expect(component.latitude).toBe(38.71);
    expect(component.longitude).toBe(-9.13);
  });

  it('does not submit stale Maps coordinates after a failed link revalidation', () => {
    venueService.resolveMapLink.and.returnValues(
      of({ resolvedUrl: 'https://www.google.com/maps/old', latitude: 38.72, longitude: -9.14 }),
      throwError(() => new Error('Invalid Maps link'))
    );
    component.venueMapLink = 'https://maps.app.goo.gl/old';
    component.resolveVenueMapLink();
    expect(component.hasCoordinates).toBeTrue();

    // A programmatic change must be just as safe as user typing.
    component.venueMapLink = 'https://maps.app.goo.gl/invalid';
    component.resolveVenueMapLink();

    expect(component.hasCoordinates).toBeFalse();
    expect(component.latitude).toBeNull();
    expect(component.longitude).toBeNull();
    expect(component.venueMapLinkError).toBeTruthy();
  });

  it('ignores a late Maps response after another venue is chosen', () => {
    const pending = new Subject<{ resolvedUrl: string; latitude: number; longitude: number }>();
    venueService.resolveMapLink.and.returnValue(pending.asObservable());

    component.venueMapLink = 'https://maps.app.goo.gl/old';
    component.resolveVenueMapLink();

    component.selectedVenueId = 10;
    component.latitude = 40.5;
    component.longitude = -8.5;
    component.locationCaptured = true;

    pending.next({
      resolvedUrl: 'https://www.google.com/maps/late',
      latitude: 38.72,
      longitude: -9.14
    });
    pending.complete();

    expect(component.selectedVenueId).toBe(10);
    expect(component.latitude).toBe(40.5);
    expect(component.longitude).toBe(-8.5);
    expect(component.venueMapCandidateResolvedUrl).toBe('');
  });

  it('keeps a separately shared GPS location when editing a Maps link', () => {
    component.applyCurrentPosition(38.72, -9.14, 15);
    component.onVenueMapLinkChanged('https://maps.app.goo.gl/another');

    expect(component.locationSource).toBe('gps');
    expect(component.hasCoordinates).toBeTrue();
    expect(component.latitude).toBe(38.72);
    expect(component.longitude).toBe(-9.14);
    expect(component.gpsAccuracyMeters).toBe(15);
  });

  it('offers GPS beside the optional Maps link without requiring a link', () => {
    const card = fixture.nativeElement.querySelector('.venue-create-card') as HTMLElement;
    const button = card.querySelector('.gps-location-action') as HTMLButtonElement;
    expect(button).not.toBeNull();
    expect(button.textContent).toContain('Usar localização atual');
    const capture = spyOn(component, 'captureCurrentLocation');
    button.click();
    expect(capture).toHaveBeenCalledTimes(1);
    expect(component.venueMapLink).toBe('');
    expect(fixture.nativeElement.querySelector('.location-section')).toBeNull();
  });

  it('saves shared GPS coordinates without requiring an invented street address', () => {
    component.sport = 'Padel';
    component.gameDate = '2099-10-15T18:00';
    component.city = 'Lisboa';
    component.address = '';
    component.venueMapLink = 'https://maps.app.goo.gl/test';
    component.venueMapCandidateResolvedUrl = 'https://maps.google.com/old';

    component.applyCurrentPosition(38.72, -9.14);
    fixture.detectChanges();

    expect(component.hasCoordinates).toBeTrue();
    expect(component.locationSource).toBe('gps');
    expect(component.venueMapLink).toBe('');
    expect(component.venueMapCandidateResolvedUrl).toBe('');
    expect(fixture.nativeElement.querySelector('.venue-create-card iframe')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('input[name="address"]')?.closest('label')?.textContent)
      .toContain('opcional');

    component.createSession();
    const request = sessionService.create.calls.mostRecent().args[0];
    expect(request).toEqual(jasmine.objectContaining({
      venueId: null, latitude: 38.72, longitude: -9.14, city: 'Lisboa'
    }));
    expect(request.address).toContain('38.720000');
    expect(request.address).toContain('-9.140000');
  });

  it('requires locality and allows the user to remove a shared GPS point', () => {
    component.sport = 'Padel';
    component.gameDate = '2099-10-15T18:00';
    component.applyCurrentPosition(38.72, -9.14);

    component.createSession();
    expect(sessionService.create).not.toHaveBeenCalled();

    component.clearLocation();
    fixture.detectChanges();

    expect(component.hasCoordinates).toBeFalse();
    expect(component.latitude).toBeNull();
    expect(component.longitude).toBeNull();
    expect(component.selectedVenueMapUrl).toBeNull();
    expect(fixture.nativeElement.querySelector('.venue-create-card iframe')).toBeNull();
    expect(fixture.nativeElement.querySelector('input[name="address"]')?.closest('label')?.textContent)
      .not.toContain('opcional');
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

  it('lets the organiser replace a selected venue with another in a different city', () => {
    component.venues = [
      {
        id: 101, name: 'Campo de Lisboa', city: 'Lisboa',
        address: 'Rua A', sports: 'Padel', latitude: 38.72, longitude: -9.14
      } as Venue,
      {
        id: 102, name: 'Campo do Porto', city: 'Porto',
        address: 'Rua B', sports: 'Padel', latitude: 41.15, longitude: -8.61
      } as Venue
    ];
    component.sport = 'Padel';
    component.selectVenue(101);
    component.venueSearch = 'Campo de Lisboa · Lisboa';
    fixture.detectChanges();

    expect(component.selectedVenueId).toBe(101);
    expect(component.city).toBe('Lisboa');
    expect(component.venueOptions.map(venue => venue.id)).toEqual([101]);

    const search = fixture.nativeElement.querySelector('input[name="venueSearch"]') as HTMLInputElement;
    search.value = 'Campo do Porto · Porto';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(component.venueSearch).toBe('Campo do Porto · Porto');
    expect(component.selectedVenueId).toBeNull();
    expect(component.city).toBe('');
    expect(component.address).toBe('');
    expect(component.latitude).toBeNull();
    expect(component.longitude).toBeNull();
    expect(component.venueOptions.map(venue => venue.id)).toEqual([102]);

    search.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(component.selectedVenueId).toBe(102);
    expect(component.city).toBe('Porto');
    expect(component.address).toBe('Rua B');
    expect(component.latitude).toBe(41.15);
    expect(component.longitude).toBe(-8.61);
  });

  it('keeps manually entered location when searching without a selected venue', () => {
    component.sport = 'Padel';
    component.city = 'Lisboa';
    component.address = 'Campo de treino';
    component.applyCurrentPosition(38.7, -9.4, 20);

    component.onVenueSearchChanged('Outro campo');

    expect(component.selectedVenueId).toBeNull();
    expect(component.venueSearch).toBe('Outro campo');
    expect(component.city).toBe('Lisboa');
    expect(component.address).toBe('Campo de treino');
    expect(component.locationSource).toBe('gps');
    expect(component.latitude).toBe(38.7);
    expect(component.longitude).toBe(-9.4);
    expect(component.gpsAccuracyMeters).toBe(20);
  });

  it('keeps the latest venue photograph when photo responses arrive out of order', () => {
    const firstPhotos = new Subject<VenuePhoto[]>();
    const secondPhotos = new Subject<VenuePhoto[]>();
    venueService.listPhotos.and.callFake(id =>
      id === 101 ? firstPhotos.asObservable() : secondPhotos.asObservable()
    );
    component.venues = [
      { id: 101, name: 'Primeiro Campo', city: 'Lisboa', address: 'Rua A',
        sports: 'Padel', latitude: 38.72, longitude: -9.14 } as Venue,
      { id: 102, name: 'Segundo Campo', city: 'Porto', address: 'Rua B',
        sports: 'Padel', latitude: 41.15, longitude: -8.61 } as Venue
    ];

    component.selectVenue(101);
    component.selectVenue(102);
    expect(component.venuePhotoLoading).toBeTrue();

    firstPhotos.next([{
      id: 1, photoUrl: '/first.jpg', uploadedByUsername: null,
      createdAt: '2026-10-14T00:00:00Z'
    }]);
    firstPhotos.complete();

    expect(component.selectedVenuePhoto).toBeNull();
    expect(component.venuePhotoLoading).toBeTrue();

    secondPhotos.next([{
      id: 2, photoUrl: '/second.jpg', uploadedByUsername: null,
      createdAt: '2026-10-14T00:00:00Z'
    }]);
    secondPhotos.complete();
    fixture.detectChanges();

    expect(component.selectedVenueId).toBe(102);
    expect(component.selectedVenuePhoto?.photoUrl).toBe('/second.jpg');
    expect(component.venuePhotoLoading).toBeFalse();
    const preview = fixture.nativeElement.querySelector('.venue-preview img') as HTMLImageElement;
    expect(preview.getAttribute('src')).toBe('/second.jpg');
  });

  it('ignores a pending venue photograph after switching to the Maps option', () => {
    const pending = new Subject<VenuePhoto[]>();
    venueService.listPhotos.and.returnValue(pending.asObservable());
    component.venues = [{
      id: 101, name: 'Campo', city: 'Lisboa', address: 'Rua A',
      sports: 'Padel', latitude: 38.72, longitude: -9.14
    } as Venue];

    component.selectVenue(101);
    expect(component.venuePhotoLoading).toBeTrue();
    component.useMapLinkVenue();

    pending.next([{
      id: 1, photoUrl: '/old.jpg', uploadedByUsername: null,
      createdAt: '2026-10-14T00:00:00Z'
    }]);
    pending.complete();
    fixture.detectChanges();

    expect(component.selectedVenueId).toBeNull();
    expect(component.selectedVenuePhoto).toBeNull();
    expect(component.venuePhotoLoading).toBeFalse();
    expect(fixture.nativeElement.querySelector('.venue-preview img')).toBeNull();
  });

  it('rejects a venue that is incompatible with the selected sport', () => {
    component.venues = [{
      id: 101, name: 'Campo de Futsal', city: 'Lisboa',
      address: 'Rua A', sports: 'Futsal',
      latitude: 38.73, longitude: -9.15
    } as Venue];
    component.sport = 'Padel';
    component.venueSearch = 'Campo de Futsal · Lisboa';

    component.confirmVenueSelection();

    expect(component.selectedVenueId).toBeNull();
    expect(component.city).toBe('');
    expect(component.address).toBe('');
    expect(component.latitude).toBeNull();
    expect(component.longitude).toBeNull();
  });

  it('does not confuse Futebol with Futebol Americano when checking venue sports', () => {
    component.venues = [{
      id: 102, name: 'Campo de Futebol Americano', city: 'Lisboa',
      address: 'Rua B', sports: 'Futebol Americano',
      latitude: 38.74, longitude: -9.16
    } as Venue];
    component.sport = 'Futebol';
    component.venueSearch = 'Campo de Futebol Americano · Lisboa';

    expect(component.venueOptions).toEqual([]);
    component.confirmVenueSelection();

    expect(component.selectedVenueId).toBeNull();
  });

  it('accepts a compatible venue using its full autocomplete label', () => {
    component.venues = [{
      id: 101, name: 'Pavilhão Municipal', city: 'Lisboa',
      address: 'Rua A', sports: 'Padel;Futsal',
      latitude: 38.73, longitude: -9.15
    } as Venue];
    component.sport = 'Padel';
    component.venueSearch = 'Pavilhão Municipal · Lisboa';

    expect(component.venueOptions.map(venue => venue.id)).toEqual([101]);
    component.confirmVenueSelection();

    expect(component.selectedVenueId).toBe(101);
    expect(component.city).toBe('Lisboa');
    expect(component.address).toBe('Rua A');
    expect(component.latitude).toBe(38.73);
    expect(component.longitude).toBe(-9.15);
  });

  it('does not accept a venue excluded by the city filter', () => {
    component.venues = [{
      id: 101, name: 'Pavilhão Municipal', city: 'Porto',
      address: 'Rua A', sports: 'Padel',
      latitude: 41.15, longitude: -8.61
    } as Venue];
    component.sport = 'Padel';
    component.city = 'Lisboa';
    component.venueSearch = 'Pavilhão Municipal · Porto';

    component.confirmVenueSelection();

    expect(component.selectedVenueId).toBeNull();
    expect(component.city).toBe('Lisboa');
    expect(component.address).toBe('');
  });

  it('blocks submission if the sport changes after a venue was selected', () => {
    component.venues = [{
      id: 17, name: 'Pavilhão de Futsal', city: 'Lisboa',
      address: 'Rua A', sports: 'Futsal', latitude: 38.73, longitude: -9.15
    } as Venue];
    component.sport = 'Futsal';
    component.selectVenue(17);
    component.gameDate = '2099-10-15T18:00';

    component.sport = 'Padel'; // Model changed before the field blur event.
    component.createSession();

    expect(sessionService.create).not.toHaveBeenCalled();
    expect(component.errorMessage).toContain('modalidade');
    expect(component.selectedVenueId).toBe(17);
  });

  it('allows a session at a venue that supports the selected sport', () => {
    component.venues = [{
      id: 17, name: 'Pavilhão Municipal', city: 'Lisboa',
      address: 'Rua A', sports: 'Futsal; Padel',
      latitude: 38.73, longitude: -9.15
    } as Venue];
    component.sport = 'Futsal';
    component.selectVenue(17);
    component.gameDate = '2099-10-15T18:00';

    component.sport = 'Padel';
    component.createSession();

    expect(sessionService.create).toHaveBeenCalledWith(
      jasmine.objectContaining({ venueId: 17, sport: 'Padel' }),
      undefined
    );
  });

  it('blocks submission if the formerly selected venue is no longer loaded', () => {
    component.sport = 'Padel';
    component.gameDate = '2099-10-15T18:00';
    component.city = 'Lisboa';
    component.address = 'Rua A';
    component.selectedVenueId = 999;

    component.createSession();

    expect(sessionService.create).not.toHaveBeenCalled();
    expect(component.errorMessage).toContain('recinto');
  });

  it('does not create a venue without a selected sport', () => {
    component.sport = '';
    component.venueName = 'Campo Novo';
    component.city = 'Lisboa';
    component.address = 'Rua A';

    component.saveVenue();

    expect(venueService.create).not.toHaveBeenCalled();
    expect(component.venueSaving).toBeFalse();
    expect(component.errorMessage).toContain('modalidade');
  });

  it('does not create a venue with a sport outside the catalog', () => {
    component.sport = 'Modalidade inventada';
    component.venueName = 'Campo Novo';
    component.city = 'Lisboa';
    component.address = 'Rua A';

    component.saveVenue();

    expect(venueService.create).not.toHaveBeenCalled();
    expect(component.errorMessage).toContain('modalidade');
  });

  it('sends the selected catalog sport when saving a venue', () => {
    venueService.create.and.returnValue(of({
      id: 303, name: 'Campo Novo', city: 'Lisboa', address: 'Rua A',
      sports: 'Padel', latitude: null, longitude: null
    } as Venue));
    component.sport = 'Padel';
    component.venueName = 'Campo Novo';
    component.city = 'Lisboa';
    component.address = 'Rua A';

    component.saveVenue();

    expect(venueService.create).toHaveBeenCalledWith(
      jasmine.objectContaining({ sports: 'Padel', name: 'Campo Novo' })
    );
    expect(component.selectedVenueId).toBe(303);
  });

  it('selects a newly created venue and refreshes its search, map and photograph', () => {
    const venue = {
      id: 301, name: 'Campo Novo', city: 'Lisboa', address: 'Rua A',
      sports: 'Padel', latitude: 38.72, longitude: -9.14
    } as Venue;
    venueService.create.and.returnValue(of(venue));
    venueService.listPhotos.and.returnValue(of([{
      id: 8, photoUrl: '/new-venue.jpg', uploadedByUsername: null,
      createdAt: '2026-10-14T00:00:00Z'
    }]));
    component.sport = 'Padel';
    component.venueName = 'Campo Novo';
    component.city = 'Lisboa';
    component.address = 'Rua A';
    component.showVenueCreator = true;
    component.applyCurrentPosition(38.72, -9.14, 17);

    component.saveVenue();
    fixture.detectChanges();

    expect(venueService.create).toHaveBeenCalledTimes(1);
    expect(venueService.listPhotos).toHaveBeenCalledWith(301);
    expect(component.selectedVenueId).toBe(301);
    expect(component.venueSearch).toBe('Campo Novo · Lisboa');
    expect(component.city).toBe('Lisboa');
    expect(component.address).toBe('Rua A');
    expect(component.latitude).toBe(38.72);
    expect(component.longitude).toBe(-9.14);
    expect(component.locationSource).toBeNull();
    expect(component.selectedVenuePhoto?.photoUrl).toBe('/new-venue.jpg');
    expect(component.showVenueCreator).toBeFalse();
    expect(fixture.nativeElement.querySelector('.venue-preview img')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.venue-preview iframe')).not.toBeNull();
  });

  it('clears an obsolete map point when a newly saved venue has no coordinates', () => {
    venueService.create.and.returnValue(of({
      id: 302, name: 'Campo sem mapa', city: 'Lisboa', address: 'Rua B',
      sports: 'Padel', latitude: null, longitude: null
    } as Venue));
    component.sport = 'Padel';
    component.venueName = 'Campo sem mapa';
    component.city = 'Lisboa';
    component.address = 'Rua B';
    component.applyCurrentPosition(38.72, -9.14);

    component.saveVenue();
    fixture.detectChanges();

    expect(component.selectedVenueId).toBe(302);
    expect(component.venueSearch).toBe('Campo sem mapa · Lisboa');
    expect(component.city).toBe('Lisboa');
    expect(component.address).toBe('Rua B');
    expect(component.latitude).toBeNull();
    expect(component.longitude).toBeNull();
    expect(component.locationCaptured).toBeFalse();
    expect(component.selectedVenueMapUrl).toBeNull();
    expect(fixture.nativeElement.querySelector('.venue-preview iframe')).toBeNull();
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

    component.sport = 'Padel';
    component.confirmSportSelection();

    expect(component.selectedVenueId).toBeNull();
    expect(component.city).toBe('');
    expect(component.address).toBe('');
    expect(component.locationCaptured).toBeFalse();
    expect(component.latitude).toBeNull();
    expect(component.longitude).toBeNull();
    expect(component.selectedVenueMapUrl).toBeNull();
  });

  it('preserves manual or GPS location when there was no previously selected venue', () => {
    component.city = 'Cascais';
    component.address = 'Campo junto à praia';
    component.applyCurrentPosition(38.7, -9.4, 18);

    component.selectVenue(null);

    expect(component.city).toBe('Cascais');
    expect(component.address).toBe('Campo junto à praia');
    expect(component.locationSource).toBe('gps');
    expect(component.locationCaptured).toBeTrue();
    expect(component.latitude).toBe(38.7);
    expect(component.longitude).toBe(-9.4);
    expect(component.gpsAccuracyMeters).toBe(18);
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
