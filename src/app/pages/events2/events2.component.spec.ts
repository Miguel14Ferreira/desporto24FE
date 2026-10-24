import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';

import { Events2Component } from './events2.component';
import { Venue } from '../model/venue';
import { SessionService } from '../../services/session.service';
import { CommunityGroupsService } from '../../services/community-groups.service';
import { VenuePhoto, VenueService, VenueSuggestionPage } from '../../services/venue.service';
import { TEST_IMPORTS, TEST_PROVIDERS } from '../../testing/test-providers';

describe('Events2Component', () => {
  let component: Events2Component;
  let fixture: ComponentFixture<Events2Component>;
  let sessionService: jasmine.SpyObj<SessionService>;
  let venueService: jasmine.SpyObj<VenueService>;
  let router: Router;

  beforeEach(async () => {
    sessionService = jasmine.createSpyObj<SessionService>('SessionService', ['create']);
    venueService = jasmine.createSpyObj<VenueService>('VenueService', ['search', 'suggest', 'create', 'listPhotos', 'resolveMapLink']);
    venueService.suggest.and.returnValue(of({ venues: [], page: 0, hasMore: false }));
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
      gamePhoto: null,
      canSharePublicly: true
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
    component.venueDistrict = 'Lisboa';
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.returnValue(Promise.resolve(true));
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('styles the community recurrence selector like the other session inputs', () => {
    component.communityId = 7;
    fixture.detectChanges();

    const select = fixture.nativeElement.querySelector(
      'select[name="recurrence"]'
    ) as HTMLSelectElement | null;
    const sportInput = fixture.nativeElement.querySelector(
      'input[name="sport"]'
    ) as HTMLInputElement | null;

    expect(select).not.toBeNull();
    expect(sportInput).not.toBeNull();
    if (!select || !sportInput) return;

    const selectStyle = getComputedStyle(select);
    const inputStyle = getComputedStyle(sportInput);
    expect(selectStyle.borderRadius).toBe(inputStyle.borderRadius);
    expect(selectStyle.backgroundColor).toBe(inputStyle.backgroundColor);
    expect(selectStyle.paddingTop).toBe(inputStyle.paddingTop);
    expect(selectStyle.paddingBottom).toBe(inputStyle.paddingBottom);
    expect(Math.abs(select.getBoundingClientRect().width
      - sportInput.getBoundingClientRect().width)).toBeLessThan(2);

    select.value = 'WEEKLY';
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(component.recurrence).toBe('WEEKLY');
    expect(fixture.nativeElement.querySelector(
      'input[name="recurrenceOccurrences"]'
    )).not.toBeNull();
  });

  it('offers three exclusive location methods without requiring a venue in the catalogue', () => {
    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('.location-methods .location-method')
    ) as HTMLButtonElement[];
    expect(buttons.length).toBe(3);
    expect(buttons[0].getAttribute('aria-pressed')).toBe('true');
    expect(fixture.nativeElement.querySelector('input[name="venueSearch"]')).toBeTruthy();

    buttons[1].click();
    fixture.detectChanges();
    expect(component.locationMethod).toBe('maps');
    expect(fixture.nativeElement.querySelector('input[name="venueSearch"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('input[name="venueMapLink"]')).toBeTruthy();

    fixture.nativeElement.querySelectorAll('.location-method')[2].click();
    fixture.detectChanges();
    expect(component.locationMethod).toBe('gps');
    expect(fixture.nativeElement.querySelector('input[name="venueMapLink"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('.gps-location-action')).toBeTruthy();

    fixture.nativeElement.querySelectorAll('.location-method')[0].click();
    fixture.detectChanges();
    expect(component.locationMethod).toBe('venue');
    expect(fixture.nativeElement.querySelector('input[name="venueSearch"]')).toBeTruthy();
  });

  it('requires resolving a Maps URL before creating a session without a saved venue', () => {
    component.sport = 'Padel';
    component.gameDate = '2099-10-15T18:00';
    component.chooseLocationMethod('maps');
    component.city = 'Lisboa';
    component.createSession();
    expect(sessionService.create).not.toHaveBeenCalled();
    expect(component.errorMessage).toContain('Google Maps');

    venueService.resolveMapLink.and.returnValue(of({
      resolvedUrl: 'https://www.google.com/maps?q=38.7,-9.1',
      latitude: 38.7, longitude: -9.1
    }));
    component.onVenueMapLinkChanged('https://www.google.com/maps?q=38.7,-9.1');
    component.resolveVenueMapLink();
    expect(component.locationSource).toBe('map');
    component.createSession();
    expect(sessionService.create).toHaveBeenCalledWith(
      jasmine.objectContaining({
        latitude: 38.7, longitude: -9.1, venueId: null, city: 'Lisboa'
      }), undefined
    );
  });

  it('replaces Maps coordinates with current GPS and never reuses them on switching source', () => {
    component.chooseLocationMethod('maps');
    venueService.resolveMapLink.and.returnValue(of({
      resolvedUrl: 'https://www.google.com/maps?q=38.7,-9.1',
      latitude: 38.7, longitude: -9.1
    }));
    component.onVenueMapLinkChanged('https://www.google.com/maps?q=38.7,-9.1');
    component.resolveVenueMapLink();
    expect(component.hasCoordinates).toBeTrue();

    component.chooseLocationMethod('gps');
    expect(component.hasCoordinates).toBeFalse();
    expect(component.venueMapLink).toBe('');
    component.sport = 'Padel';
    component.city = 'Lisboa';
    component.gameDate = '2099-10-15T18:00';
    component.createSession();
    expect(sessionService.create).not.toHaveBeenCalled();
    expect(component.errorMessage).toContain('localização atual');

    component.applyCurrentPosition(38.72, -9.14, 14);
    component.createSession();
    expect(sessionService.create).toHaveBeenCalledWith(
      jasmine.objectContaining({
        latitude: 38.72, longitude: -9.14, venueId: null
      }), undefined
    );

    component.chooseLocationMethod('venue');
    expect(component.hasCoordinates).toBeFalse();
    expect(component.locationSource).toBeNull();
  });

  it('shows a retry action instead of silently treating a failed venue load as empty', () => {
    venueService.suggest.and.returnValue(throwError(() => new Error('Offline')));

    component.loadVenues();
    fixture.detectChanges();

    expect(component.venuesLoadError).toBeTrue();
    expect(component.venues).toEqual([]);
    const alert = fixture.nativeElement.querySelector('.venue-load-error') as HTMLElement;
    expect(alert).not.toBeNull();
    expect(alert.textContent).toContain('Não foi possível carregar os recintos');
    expect(alert.querySelector('button')?.textContent).toContain('Tentar novamente');
  });

  it('reloads venues after clicking retry and clears the loading error', () => {
    venueService.suggest.and.returnValue(throwError(() => new Error('Offline')));
    component.loadVenues();
    fixture.detectChanges();

    venueService.suggest.and.returnValue(of({ venues: [{
      id: 701, name: 'Campo Central', city: 'Lisboa',
      address: 'Rua A', sports: 'Padel', latitude: null, longitude: null
    } as Venue], page: 0, hasMore: false }));
    const retryButton = fixture.nativeElement.querySelector('.venue-load-error button') as HTMLButtonElement;
    retryButton.click();
    fixture.detectChanges();

    expect(component.venuesLoadError).toBeFalse();
    expect(component.venues.map(venue => venue.id)).toEqual([701]);
    expect(fixture.nativeElement.querySelector('.venue-load-error')).toBeNull();
  });

  it('does not display a loading error when the venue catalog is genuinely empty', () => {
    component.loadVenues();
    fixture.detectChanges();

    expect(component.venues).toEqual([]);
    expect(component.venuesLoadError).toBeFalse();
    expect(fixture.nativeElement.querySelector('.venue-load-error')).toBeNull();
  });

  it('keeps a newly saved venue when the initial catalog response arrives late', () => {
    const pending = new Subject<VenueSuggestionPage>();
    venueService.suggest.and.returnValue(pending.asObservable());
    component.loadVenues();
    component.sport = 'Padel';
    component.venueName = 'Campo Novo';
    component.city = 'Lisboa';
    component.address = 'Rua Nova';
    venueService.create.and.returnValue(of({
      id: 801, name: 'Campo Novo', city: 'Lisboa',
      address: 'Rua Nova', sports: 'Padel', latitude: null, longitude: null
    } as Venue));

    component.saveVenue();
    expect(component.selectedVenueId).toBe(801);

    pending.next({ venues: [{
      id: 802, name: 'Campo Antigo', city: 'Porto',
      address: 'Rua A', sports: 'Padel', latitude: null, longitude: null
    } as Venue], page: 0, hasMore: false });
    pending.complete();

    expect(component.venues.map(venue => venue.id)).toEqual([802, 801]);
    expect(component.selectedVenueId).toBe(801);
    expect(component.selectedVenue()?.name).toBe('Campo Novo');
  });

  it('retains saved venues if a pending catalog refresh fails', () => {
    const pending = new Subject<VenueSuggestionPage>();
    venueService.suggest.and.returnValue(pending.asObservable());
    component.loadVenues();
    component.sport = 'Padel';
    component.venueName = 'Campo Novo';
    component.city = 'Lisboa';
    component.address = 'Rua Nova';
    venueService.create.and.returnValue(of({
      id: 801, name: 'Campo Novo', city: 'Lisboa',
      address: 'Rua Nova', sports: 'Padel', latitude: null, longitude: null
    } as Venue));

    component.saveVenue();
    pending.error(new Error('Offline'));

    expect(component.venuesLoadError).toBeTrue();
    expect(component.venues.map(venue => venue.id)).toEqual([801]);
    expect(component.selectedVenue()?.name).toBe('Campo Novo');
  });

  it('does not duplicate a saved venue if it is also in the catalog response', () => {
    const pending = new Subject<VenueSuggestionPage>();
    venueService.suggest.and.returnValue(pending.asObservable());
    component.loadVenues();
    component.sport = 'Padel';
    component.venueName = 'Campo Novo';
    component.city = 'Lisboa';
    component.address = 'Rua Nova';
    venueService.create.and.returnValue(of({
      id: 801, name: 'Campo Novo', city: 'Lisboa',
      address: 'Rua Nova', sports: 'Padel', latitude: null, longitude: null
    } as Venue));

    component.saveVenue();
    pending.next({ venues: [{
      id: 801, name: 'Campo Novo', city: 'Lisboa',
      address: 'Rua Nova', sports: 'Padel', latitude: null, longitude: null
    } as Venue], page: 0, hasMore: false });
    pending.complete();

    expect(component.venues.filter(venue => venue.id === 801).length).toBe(1);
    expect(component.selectedVenueId).toBe(801);
  });

  it('prefills an editable sport and locality from Discover', () => {
    const route = TestBed.inject(ActivatedRoute);
    spyOn(route.snapshot.queryParamMap, 'get').and.callFake(name =>
      ({ sport: '  pAdEl  ', city: '  Lisboa  ' } as Record<string, string>)[name] ?? null
    );
    const page = TestBed.createComponent(Events2Component);
    page.detectChanges();

    expect(page.componentInstance.sport).toBe('Padel');
    expect(page.componentInstance.city).toBe('Lisboa');
    expect(page.componentInstance.selectedVenueId).toBeNull();

    page.componentInstance.sport = 'Futebol';
    page.componentInstance.city = 'Sintra';
    expect(page.componentInstance.sport).toBe('Futebol');
    expect(page.componentInstance.city).toBe('Sintra');
    page.destroy();
  });

  it('ignores an unknown sport and keeps the ordinary form defaults', () => {
    const route = TestBed.inject(ActivatedRoute);
    spyOn(route.snapshot.queryParamMap, 'get').and.callFake(name =>
      ({ sport: 'Desporto Inexistente', city: 'Porto' } as Record<string, string>)[name] ?? null
    );
    const page = TestBed.createComponent(Events2Component);
    page.detectChanges();

    expect(page.componentInstance.sport).toBe('');
    expect(page.componentInstance.city).toBe('Porto');
    page.destroy();
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

  it('prefills exactly two missing players from the quick-recruit shortcut', () => {
    const route = TestBed.inject(ActivatedRoute);
    spyOn(route.snapshot.queryParamMap, 'get').and.callFake(name =>
      ({ intent: 'findPlayers', confirmed: '8', missing: '2' } as Record<string, string>)[name] ?? null);
    component.ngOnInit();
    fixture.detectChanges();

    expect(component.findPlayersMode).toBeTrue();
    expect(component.confirmedPlayers).toBe(8);
    expect(component.maxParticipants).toBe(10);
    expect(component.availablePlaces).toBe(2);
    expect((fixture.nativeElement as HTMLElement)
      .querySelector('.recruit-remaining strong')?.textContent?.trim()).toBe('2');
    component.sport = 'Padel';
    component.gameDate = '2099-10-15T18:00';
    component.city = 'Lisboa';
    component.address = 'Rua do Campo';
    component.createSession();
    expect(sessionService.create).toHaveBeenCalledWith(
      jasmine.objectContaining({
        maxParticipants: 10,
        externalConfirmedParticipants: 7,
        privateGame: false, password: null
      }), undefined);
  });

  it('ignores malicious or invalid vacancy prefill values', () => {
    const route = TestBed.inject(ActivatedRoute);
    const query = { intent: 'findPlayers', confirmed: '99', missing: '2' };
    const get = spyOn(route.snapshot.queryParamMap, 'get')
      .and.callFake(name => (query as Record<string, string>)[name] ?? null);
    component.ngOnInit();
    expect(component.confirmedPlayers).toBe(1);
    expect(component.maxParticipants).toBe(4);
    get.and.callFake(name => ({
      intent: 'findPlayers', confirmed: '3.5', missing: '2'
    } as Record<string, string>)[name] ?? null);
    component.ngOnInit();
    expect(component.maxParticipants).toBe(4);
    get.and.callFake(name => ({
      confirmed: '8', missing: '2'
    } as Record<string, string>)[name] ?? null);
    component.ngOnInit();
    expect(component.findPlayersMode).toBeFalse();
    expect(component.maxParticipants).toBe(4);
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
    expect(router.navigate).toHaveBeenCalledWith(['/menu/events', 42], { queryParams: { created: 1 } });
  });

  it('does not advertise private sessions after creation', () => {
    sessionService.create.and.returnValue(of({
      id: 42, sport: 'Padel', city: 'Lisboa', gameDate: '2099-10-15T18:00:00Z',
      distanceKm: null, participantCount: 1, maxParticipants: 4, priceAmount: 0,
      privateGame: true, status: 'OPEN', creatorUsername: 'fixture-user',
      address: null, canSeeExactAddress: true, joined: true, waitlisted: false,
      waitlistPosition: null, gamePhoto: null, canSharePublicly: false
    }));
    component.sport = 'Padel';
    component.gameDate = '2099-10-15T18:00';
    component.city = 'Lisboa';
    component.address = 'Rua do Campo';
    component.privateGame = true;
    component.password = 'secret';
    component.createSession();
    expect(router.navigate).toHaveBeenCalledWith(['/menu/events', 42], {});
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

  it('waits for a pending Maps lookup before submitting the session', () => {
    const pending = new Subject<{ resolvedUrl: string; latitude: number; longitude: number }>();
    venueService.resolveMapLink.and.returnValue(pending.asObservable());
    component.sport = 'Padel';
    component.gameDate = '2099-10-15T18:00';
    component.city = 'Lisboa';
    component.address = 'Rua do Campo';
    component.venueMapLink = 'https://maps.app.goo.gl/new';

    component.resolveVenueMapLink();
    fixture.detectChanges();

    const submit = fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(component.venueMapLinkLoading).toBeTrue();
    expect(submit.disabled).toBeTrue();

    component.createSession();
    expect(sessionService.create).not.toHaveBeenCalled();

    pending.next({
      resolvedUrl: 'https://www.google.com/maps/new',
      latitude: 38.72, longitude: -9.14
    });
    pending.complete();
    fixture.detectChanges();

    expect(component.venueMapLinkLoading).toBeFalse();
    expect(submit.disabled).toBeFalse();

    component.createSession();
    expect(sessionService.create).toHaveBeenCalledWith(
      jasmine.objectContaining({
        latitude: 38.72, longitude: -9.14
      }),
      undefined
    );
  });

  it('re-enables session submission with a manual address after Maps lookup fails', () => {
    const pending = new Subject<{ resolvedUrl: string; latitude: number; longitude: number }>();
    venueService.resolveMapLink.and.returnValue(pending.asObservable());
    component.sport = 'Padel';
    component.gameDate = '2099-10-15T18:00';
    component.city = 'Lisboa';
    component.address = 'Rua do Campo';
    component.venueMapLink = 'https://maps.app.goo.gl/broken';

    component.resolveVenueMapLink();
    component.createSession();
    expect(sessionService.create).not.toHaveBeenCalled();

    pending.error(new Error('Link unavailable'));
    fixture.detectChanges();

    const submit = fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;
    expect(component.venueMapLinkLoading).toBeFalse();
    expect(submit.disabled).toBeFalse();

    // Explicitly switch back to a manual/saved venue after an unresolved Maps link.
    component.chooseLocationMethod('venue');
    component.city = 'Lisboa';
    component.address = 'Rua do Campo';
    component.createSession();
    expect(sessionService.create).toHaveBeenCalledWith(
      jasmine.objectContaining({
        city: 'Lisboa', address: 'Rua do Campo',
        latitude: null, longitude: null
      }),
      undefined
    );
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
    component.chooseLocationMethod('maps');
    fixture.detectChanges();
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

  it('clears GPS coordinates when changing to a Maps link', () => {
    component.applyCurrentPosition(38.72, -9.14, 15);
    component.onVenueMapLinkChanged('https://maps.app.goo.gl/another');

    expect(component.locationMethod).toBe('maps');
    expect(component.locationSource).toBeNull();
    expect(component.hasCoordinates).toBeFalse();
    expect(component.latitude).toBeNull();
    expect(component.longitude).toBeNull();
    expect(component.gpsAccuracyMeters).toBeNull();
  });

  it('offers GPS without requiring a Maps link', () => {
    component.chooseLocationMethod('gps');
    fixture.detectChanges();
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

  it('lets the organiser replace a selected venue after switching district and searching the server', fakeAsync(() => {
    const lisbon = {
      id: 101, name: 'Campo de Lisboa', city: 'Lisboa',
      address: 'Rua A', sports: 'Padel', latitude: 38.72, longitude: -9.14
    } as Venue;
    const porto = {
      id: 102, name: 'Campo do Porto', city: 'Porto',
      address: 'Rua B', sports: 'Padel', latitude: 41.15, longitude: -8.61
    } as Venue;
    component.venues = [lisbon];
    component.sport = 'Padel';
    component.selectVenue(101);
    component.venueSearch = 'Campo de Lisboa · Lisboa';
    fixture.detectChanges();

    expect(component.selectedVenueId).toBe(101);
    expect(component.city).toBe('Lisboa');

    // Old results cannot be selected in a new district or during debounce.
    venueService.suggest.and.returnValue(of({ venues: [porto], page: 0, hasMore: false }));
    component.onDistrictChanged('Porto');
    expect(component.selectedVenueId).toBeNull();
    expect(component.city).toBe('');
    expect(component.address).toBe('');
    expect(component.latitude).toBeNull();
    expect(component.longitude).toBeNull();

    const search = fixture.nativeElement.querySelector('input[name="venueSearch"]') as HTMLInputElement;
    search.value = 'Campo do Porto · Porto';
    search.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(component.venueOptions).toEqual([]);
    tick(300);
    fixture.detectChanges();

    expect(venueService.suggest).toHaveBeenCalledWith('Campo do Porto', 'Porto', 'Padel', 0, 'Porto');
    expect(component.venueOptions.map(venue => venue.id)).toEqual([102]);
    const option = fixture.nativeElement.querySelector('button.venue-result-option') as HTMLButtonElement;
    expect(option).not.toBeNull();
    option.click();
    fixture.detectChanges();

    expect(component.selectedVenueId).toBe(102);
    expect(component.city).toBe('Porto');
    expect(component.address).toBe('Rua B');
    expect(component.latitude).toBe(41.15);
    expect(component.longitude).toBe(-8.61);
  }));

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

  it('clears the previous venue search label when switching to a Maps location', () => {
    component.sport = 'Padel';
    component.venues = [{
      id: 101, name: 'Pavilhão Municipal', city: 'Lisboa',
      address: 'Rua A', sports: 'Padel', latitude: 38.73, longitude: -9.15
    } as Venue];
    component.selectVenue(101);
    component.venueSearch = 'Pavilhão Municipal · Lisboa';

    component.useMapLinkVenue();
    fixture.detectChanges();

    expect(component.selectedVenueId).toBeNull();
    expect(component.venueSearch).toBe('');
    expect(component.city).toBe('');
    expect(component.address).toBe('');
    expect(component.latitude).toBeNull();
    expect(component.longitude).toBeNull();
    expect(fixture.nativeElement.querySelector('input[name="venueSearch"]')).toBeNull();
    expect(component.venueSearch).toBe('');
  });

  it('submits a manual location without the previously selected venue after switching', () => {
    component.sport = 'Padel';
    component.gameDate = '2099-10-15T18:00';
    component.venues = [{
      id: 101, name: 'Pavilhão Municipal', city: 'Lisboa',
      address: 'Rua A', sports: 'Padel', latitude: 38.73, longitude: -9.15
    } as Venue];
    component.selectVenue(101);
    component.venueSearch = 'Pavilhão Municipal · Lisboa';

    component.useMapLinkVenue();
    // A free address is permitted in the known-venue/manual-location mode,
    // not as a substitute for an unresolved Google Maps link.
    component.chooseLocationMethod('venue');
    component.city = 'Porto';
    component.address = 'Campo novo';
    component.createSession();

    expect(sessionService.create).toHaveBeenCalledWith(
      jasmine.objectContaining({
        venueId: null, city: 'Porto', address: 'Campo novo',
        latitude: null, longitude: null
      }),
      undefined
    );
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

  it('finds venues by name, address and city without accents', () => {
    component.sport = 'Padel';
    component.venues = [{
      id: 201, name: 'Pavilhão Municipal', city: 'Évora',
      address: 'Rua da República', sports: 'Padel',
      latitude: null, longitude: null
    } as Venue];

    for (const search of ['pavilhao', 'REPUBLICA', 'evora']) {
      component.venueSearch = search;
      expect(component.venueOptions.map(venue => venue.id)).toEqual([201]);
    }
  });

  it('accepts a venue selection without accents and keeps its official label', () => {
    component.sport = 'Padel';
    component.city = 'Evora';
    component.venues = [{
      id: 201, name: 'Pavilhão Municipal', city: 'Évora',
      address: 'Rua da República', sports: 'Padel',
      latitude: null, longitude: null
    } as Venue];
    component.venueSearch = 'PAVILHAO MUNICIPAL · EVORA';

    expect(component.venueOptions.map(venue => venue.id)).toEqual([201]);
    component.confirmVenueSelection();

    expect(component.selectedVenueId).toBe(201);
    expect(component.city).toBe('Évora');
    expect(component.venueSearch).toBe('Pavilhão Municipal · Évora');
  });

  it('still rejects an incompatible sport when searching without accents', () => {
    component.sport = 'Padel';
    component.venues = [{
      id: 201, name: 'Pavilhão Municipal', city: 'Évora',
      address: 'Rua da República', sports: 'Futsal',
      latitude: null, longitude: null
    } as Venue];
    component.venueSearch = 'pavilhao municipal · evora';

    expect(component.venueOptions).toEqual([]);
    component.confirmVenueSelection();
    expect(component.selectedVenueId).toBeNull();
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

  it('does not select the first venue when two venues share the same name', () => {
    component.sport = 'Padel';
    component.venues = [
      { id: 201, name: 'Pavilhão Municipal', city: 'Lisboa', address: 'Rua A',
        sports: 'Padel', latitude: null, longitude: null } as Venue,
      { id: 202, name: 'Pavilhão Municipal', city: 'Porto', address: 'Rua B',
        sports: 'Padel', latitude: null, longitude: null } as Venue
    ];
    component.venueSearch = 'pavilhao municipal';

    component.confirmVenueSelection();

    expect(component.selectedVenueId).toBeNull();
    expect(component.city).toBe('');
    expect(component.address).toBe('');
  });

  it('selects the intended venue using the full name and city when names are repeated', () => {
    component.sport = 'Padel';
    component.venues = [
      { id: 201, name: 'Pavilhão Municipal', city: 'Lisboa', address: 'Rua A',
        sports: 'Padel', latitude: null, longitude: null } as Venue,
      { id: 202, name: 'Pavilhão Municipal', city: 'Évora', address: 'Rua B',
        sports: 'Padel', latitude: null, longitude: null } as Venue
    ];
    component.venueSearch = 'PAVILHAO MUNICIPAL · EVORA';

    component.confirmVenueSelection();

    expect(component.selectedVenueId).toBe(202);
    expect(component.city).toBe('Évora');
    expect(component.address).toBe('Rua B');
    expect(component.venueSearch).toBe('Pavilhão Municipal · Évora');
  });

  it('still selects a venue by its name alone when that name is unique', () => {
    component.sport = 'Padel';
    component.venues = [{
      id: 203, name: 'Pavilhão de Cascais', city: 'Cascais', address: 'Rua C',
      sports: 'Padel', latitude: null, longitude: null
    } as Venue];
    component.venueSearch = 'pavilhao de cascais';

    component.confirmVenueSelection();

    expect(component.selectedVenueId).toBe(203);
    expect(component.venueSearch).toBe('Pavilhão de Cascais · Cascais');
  });

  it('detects duplicate venue names even if one is beyond the first 40 suggestions', () => {
    component.sport = 'Padel';
    component.venues = [
      { id: 201, name: 'Pavilhão Municipal', city: 'Lisboa', address: 'Rua A',
        sports: 'Padel', latitude: null, longitude: null } as Venue,
      ...Array.from({ length: 39 }, (_, index) => ({
        id: 300 + index, name: 'Pavilhão Municipal - Campo ' + index,
        city: 'Lisboa', address: 'Rua B', sports: 'Padel',
        latitude: null, longitude: null
      } as Venue)),
      { id: 202, name: 'Pavilhão Municipal', city: 'Porto', address: 'Rua C',
        sports: 'Padel', latitude: null, longitude: null } as Venue
    ];
    component.venueSearch = 'Pavilhão Municipal';

    // Loaded pages can now be displayed beyond the legacy 40-item local cap.
    expect(component.venueOptions.length).toBe(41);
    expect(component.venueOptions.some(venue => venue.id === 202)).toBeTrue();

    component.confirmVenueSelection();
    expect(component.selectedVenueId).toBeNull();

    component.venueSearch = 'Pavilhão Municipal · Porto';
    component.confirmVenueSelection();
    expect(component.selectedVenueId).toBe(202);
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
  it('keeps multi-sport communities unselected until organiser chooses a sport', () => {
    const route = TestBed.inject(ActivatedRoute);
    spyOn(route.snapshot.queryParamMap, 'get')
      .and.callFake(name => name === 'community' ? '7' : null);
    const communities = TestBed.inject(CommunityGroupsService);
    spyOn(communities, 'get').and.returnValue(of({
      id: 7, name: 'Desportistas de Lisboa', sport: 'Futebol',
      sports: ['Futebol', 'Padel']
    } as any));

    const page = TestBed.createComponent(Events2Component);
    page.detectChanges();
    const current = page.componentInstance;
    expect(current.communityId).toBe(7);
    expect(current.communityName).toBe('Desportistas de Lisboa');
    expect(current.communitySports).toEqual(['Futebol', 'Padel']);
    expect(current.sport).toBe('');
    const options = page.nativeElement.querySelectorAll('.community-sport-option');
    expect(options.length).toBe(2);
    expect(page.nativeElement.querySelector('.community-context a')?.getAttribute('href'))
      .toBe('/menu/communities/7');

    (options[1] as HTMLButtonElement).click();
    page.detectChanges();
    expect(current.sport).toBe('Padel');
    expect(venueService.suggest).not.toHaveBeenCalled();
    current.onDistrictChanged('Lisboa');
    expect(venueService.suggest).toHaveBeenCalledWith('', '', 'Padel', 0, 'Lisboa');
    current.gameDate = '2099-10-15T18:00';
    current.city = 'Lisboa';
    current.address = 'Campo Central';
    current.maxParticipants = 4;
    current.createSession();
    expect(sessionService.create).toHaveBeenCalledWith(
      jasmine.objectContaining({ sport: 'Padel', communityId: 7 }), undefined
    );
    page.destroy();
  });

  it('prefills the only sport for older single-sport communities', () => {
    const route = TestBed.inject(ActivatedRoute);
    spyOn(route.snapshot.queryParamMap, 'get')
      .and.callFake(name => name === 'community' ? '8' : null);
    const communities = TestBed.inject(CommunityGroupsService);
    spyOn(communities, 'get').and.returnValue(of({
      id: 8, name: 'Futebol de Bairro', sport: 'Futebol'
    } as any));
    const page = TestBed.createComponent(Events2Component);
    page.detectChanges();
    expect(page.componentInstance.communitySports).toEqual(['Futebol']);
    expect(page.componentInstance.sport).toBe('Futebol');
    page.destroy();
  });

  it('keeps sport freedom and requires manual choice for sportless communities', () => {
    const route = TestBed.inject(ActivatedRoute);
    spyOn(route.snapshot.queryParamMap, 'get')
      .and.callFake(name => name === 'community' ? '9' : null);
    const communities = TestBed.inject(CommunityGroupsService);
    spyOn(communities, 'get').and.returnValue(of({
      id: 9, name: 'Desporto Livre', sport: null, sports: []
    } as any));
    const page = TestBed.createComponent(Events2Component);
    page.detectChanges();
    expect(page.componentInstance.sport).toBe('');
    expect(page.nativeElement.querySelector('.community-sport-choices')).toBeNull();
    page.componentInstance.sport = 'Basquetebol';
    page.componentInstance.confirmSportSelection();
    expect(page.componentInstance.sport).toBe('Basquetebol');
    page.destroy();
  });

});
