import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { EventsComponent } from './events.component';
import { TEST_IMPORTS, TEST_PROVIDERS } from '../../testing/test-providers';
import { SessionService } from '../../services/session.service';

describe('EventsComponent', () => {
  let component: EventsComponent;
  let fixture: ComponentFixture<EventsComponent>;
  let sessionService: jasmine.SpyObj<SessionService>;

  beforeEach(async () => {
    sessionService = jasmine.createSpyObj<SessionService>('SessionService', ['discover']);
    sessionService.discover.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      declarations: [EventsComponent],
      imports: TEST_IMPORTS,
      providers: [
        ...TEST_PROVIDERS,
        { provide: SessionService, useValue: sessionService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(EventsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load discovered sessions on init', () => {
    expect(component.sessions).toEqual([]);
    expect(sessionService.discover).toHaveBeenCalled();
  });

  it('shows full sessions by default while retaining the only-with-vacancies filter', () => {
    expect(component.availableOnly).toBeFalse();
    expect(sessionService.discover).toHaveBeenCalledWith(
      jasmine.objectContaining({ availability: undefined })
    );

    component.availableOnly = true;
    component.loadSessions();
    expect(sessionService.discover).toHaveBeenCalledWith(
      jasmine.objectContaining({ availability: 'available' })
    );

    component.clearFilters();
    expect(component.availableOnly).toBeFalse();
    expect(sessionService.discover.calls.mostRecent().args[0].availability).toBeUndefined();
  });

  it('should send coordinates and radius when nearby search is active', () => {
    component.nearbyActive = true;
    component.latitude = 38.72;
    component.longitude = -9.14;
    component.radiusKm = 10;
    component.sort = 'distance';

    component.loadSessions();

    expect(sessionService.discover).toHaveBeenCalledWith(
      jasmine.objectContaining({
        latitude: 38.72,
        longitude: -9.14,
        radiusKm: 10,
        sort: 'distance'
      })
    );
  });

  it('should send advanced time and price filters', () => {
    component.fromDateTime = '2026-10-02T18:00';
    component.toDateTime = '2026-10-02T22:00';
    component.minPrice = 2;
    component.maxPrice = 10;

    component.loadSessions();

    expect(sessionService.discover).toHaveBeenCalledWith(
      jasmine.objectContaining({
        from: jasmine.any(String),
        to: jasmine.any(String),
        minPrice: 2,
        maxPrice: 10
      })
    );
  });

  it('should calculate vacancies and join eligibility', () => {
    const openSession = {
      id: 1,
      sport: 'Padel',
      city: 'Lisboa',
      gameDate: new Date(Date.now() + 86_400_000).toISOString(),
      distanceKm: null,
      participantCount: 2,
      maxParticipants: 4,
      priceAmount: 7.5,
      privateGame: false,
      status: 'OPEN'
    };

    expect(component.vacancies(openSession)).toBe(2);
    expect(component.canJoin(openSession)).toBeTrue();
    expect(component.canJoin({ ...openSession, privateGame: true })).toBeFalse();
    expect(component.canJoin({ ...openSession, participantCount: 4 })).toBeFalse();
    expect(component.canJoin({ ...openSession, joinedByViewer: true })).toBeFalse();
    expect(component.canJoin({ ...openSession, waitlistedByViewer: true })).toBeFalse();
    expect(component.canJoin({ ...openSession, status: 'CANCELLED' })).toBeFalse();
    expect(component.canJoin({
      ...openSession, gameDate: new Date(Date.now() - 86_400_000).toISOString()
    })).toBeFalse();
    expect(component.canJoin({ ...openSession, gameDate: 'invalid-date' })).toBeFalse();
  });

  it('offers the waitlist from the session list only for joinable full games', () => {
    const fullSession = {
      id: 22,
      sport: 'Padel',
      city: 'Lisboa',
      gameDate: new Date(Date.now() + 86_400_000).toISOString(),
      distanceKm: null,
      participantCount: 4,
      maxParticipants: 4,
      priceAmount: 0,
      privateGame: false,
      status: 'FULL'
    };

    expect(component.canJoinWaitlist(fullSession)).toBeTrue();
    expect(component.canJoin(fullSession)).toBeFalse();

    component.sessions = [fullSession];
    fixture.detectChanges();

    const action = fixture.nativeElement.querySelector(
      '.session-row .session-action'
    ) as HTMLAnchorElement;
    expect(action.getAttribute('href')).toBe('/menu/events/22');
    expect(action.textContent).toContain('lista de espera');
    expect(action.classList.contains('session-action--join')).toBeTrue();

    expect(component.canJoinWaitlist({ ...fullSession, privateGame: true })).toBeFalse();
    expect(component.canJoinWaitlist({ ...fullSession, joinedByViewer: true })).toBeFalse();
    expect(component.canJoinWaitlist({ ...fullSession, waitlistedByViewer: true })).toBeFalse();
    expect(component.canJoinWaitlist({ ...fullSession, status: 'CANCELLED' })).toBeFalse();
    expect(component.canJoinWaitlist({ ...fullSession, status: 'OPEN' })).toBeFalse();
    expect(component.canJoinWaitlist({
      ...fullSession, gameDate: new Date(Date.now() - 86_400_000).toISOString()
    })).toBeFalse();
  });

  it('should disable nearby search and clear coordinates', () => {
    component.nearbyActive = true;
    component.latitude = 38.72;
    component.longitude = -9.14;

    component.disableNearby();

    expect(component.nearbyActive).toBeFalse();
    expect(component.latitude).toBeNull();
    expect(component.longitude).toBeNull();
  });
});
