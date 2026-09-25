import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';

import { SessionDetailsComponent } from './session-details.component';
import { SessionService } from '../../services/session.service';
import { TEST_IMPORTS, TEST_PROVIDERS } from '../../testing/test-providers';

describe('SessionDetailsComponent', () => {
  let component: SessionDetailsComponent;
  let fixture: ComponentFixture<SessionDetailsComponent>;
  let sessionService: jasmine.SpyObj<SessionService>;

  const session = {
    id: 7,
    sport: 'Padel',
    city: 'Lisboa',
    gameDate: '2026-10-01T18:00:00Z',
    distanceKm: null,
    participantCount: 2,
    maxParticipants: 4,
    priceAmount: 5,
    privateGame: false,
    status: 'OPEN',
    creatorUsername: 'creator-user',
    address: null,
    canSeeExactAddress: false,
    joined: false,
    waitlisted: false,
    waitlistPosition: null,
    gamePhoto: null
  };

  beforeEach(async () => {
    sessionService = jasmine.createSpyObj<SessionService>(
      'SessionService',
      ['detail', 'join', 'leave']
    );
    sessionService.detail.and.returnValue(of(session));
    sessionService.join.and.returnValue(of({
      state: 'PARTICIPANT',
      waitlistPosition: null
    }));
    sessionService.leave.and.returnValue(of(void 0));

    await TestBed.configureTestingModule({
      declarations: [SessionDetailsComponent],
      imports: TEST_IMPORTS,
      providers: [
        ...TEST_PROVIDERS,
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ id: '7' })
            }
          }
        },
        {
          provide: SessionService,
          useValue: sessionService
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(SessionDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load the session from the route id', () => {
    expect(component.session?.id).toBe(7);
  });

  it('should join the session and refresh its details', () => {
    component.joinSession();

    expect(sessionService.join).toHaveBeenCalledWith(7, '');
    expect(sessionService.detail).toHaveBeenCalledTimes(2);
    expect(component.actionSuccess).toContain('sucesso');
  });

  it('should require a password for private sessions', () => {
    component.session = {
      ...session,
      privateGame: true
    };

    component.joinSession();

    expect(sessionService.join).not.toHaveBeenCalled();
    expect(component.actionError).toContain('palavra-passe');
  });
});
