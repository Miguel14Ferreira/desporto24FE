import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';

import { SessionDetailsComponent } from './session-details.component';
import { SessionService } from '../../services/session.service';
import { ReliabilityService } from '../../services/reliability.service';
import { TEST_IMPORTS, TEST_PROVIDERS } from '../../testing/test-providers';

describe('SessionDetailsComponent', () => {
  let component: SessionDetailsComponent;
  let fixture: ComponentFixture<SessionDetailsComponent>;
  let sessionService: jasmine.SpyObj<SessionService>;
  let reliabilityService: jasmine.SpyObj<ReliabilityService>;

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
      ['detail', 'join', 'leave', 'messages', 'postMessage', 'participants']
    );
    sessionService.detail.and.returnValue(of(session));
    sessionService.join.and.returnValue(of({
      state: 'PARTICIPANT',
      waitlistPosition: null
    }));
    sessionService.leave.and.returnValue(of(void 0));
    sessionService.messages.and.returnValue(of([]));
    sessionService.participants.and.returnValue(of([
      {
        id: 15,
        username: 'player-one',
        attendanceStatus: 'PENDING',
        joinedAt: '2026-09-20T18:00:00Z'
      }
    ]));
    sessionService.postMessage.and.returnValue(of({
      id: 1,
      sessionId: 7,
      senderUsername: 'fixture-user',
      body: 'Bora jogar!',
      createdAt: '2026-10-01T16:00:00Z'
    }));

    reliabilityService = jasmine.createSpyObj<ReliabilityService>(
      'ReliabilityService',
      ['summary', 'recordAttendance']
    );
    reliabilityService.summary.and.returnValue(of({
      attendanceRate: 90,
      completedSessions: 10,
      noShows: 1,
      lateCancellations: 0,
      penaltyScore: 1,
      warning: false,
      reducedPriority: false,
      joinRestricted: false
    }));
    reliabilityService.recordAttendance.and.returnValue(of(void 0));

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
        },
        {
          provide: ReliabilityService,
          useValue: reliabilityService
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

  it('should load creator reliability with the session', () => {
    expect(reliabilityService.summary).toHaveBeenCalledWith('creator-user');
    expect(component.creatorReliability?.attendanceRate).toBe(90);
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

  it('should load chat messages for a participant', () => {
    component.session = {
      ...session,
      joined: true
    };

    component.refreshMessages();

    expect(sessionService.messages).toHaveBeenCalledWith(7);
    expect(component.messages).toEqual([]);
  });

  it('should send a chat message and append it locally', () => {
    component.session = {
      ...session,
      joined: true
    };
    component.messageBody = '  Bora jogar!  ';

    component.sendMessage();

    expect(sessionService.postMessage).toHaveBeenCalledWith(7, 'Bora jogar!');
    expect(component.messages.length).toBe(1);
    expect(component.messageBody).toBe('');
  });

  it('should allow the creator to load active participants', () => {
    (component as any).currentUsername = 'creator-user';
    component.session = {
      ...session,
      joined: true
    };

    component.loadParticipants();

    expect(sessionService.participants).toHaveBeenCalledWith(7);
    expect(component.participants.length).toBe(1);
  });

  it('should record participant attendance after the session starts', () => {
    (component as any).currentUsername = 'creator-user';
    component.session = {
      ...session,
      gameDate: '2020-10-01T18:00:00Z',
      joined: true
    };
    const participant = {
      id: 15,
      username: 'player-one',
      attendanceStatus: 'PENDING',
      joinedAt: '2026-09-20T18:00:00Z'
    } as any;

    component.recordAttendance(participant, 'ATTENDED');

    expect(reliabilityService.recordAttendance).toHaveBeenCalledWith(7, 15, 'ATTENDED');
    expect(participant.attendanceStatus).toBe('ATTENDED');
  });
});
