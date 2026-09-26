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
