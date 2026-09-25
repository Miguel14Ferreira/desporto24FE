import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';

import { SessionDetailsComponent } from './session-details.component';
import { SessionService } from '../../services/session.service';
import { TEST_IMPORTS, TEST_PROVIDERS } from '../../testing/test-providers';

describe('SessionDetailsComponent', () => {
  let component: SessionDetailsComponent;
  let fixture: ComponentFixture<SessionDetailsComponent>;

  beforeEach(async () => {
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
          useValue: {
            detail: () => of({
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
              creatorUsername: 'fixture-user',
              address: null,
              canSeeExactAddress: false,
              joined: false,
              waitlisted: false,
              waitlistPosition: null,
              gamePhoto: null
            })
          }
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
});
