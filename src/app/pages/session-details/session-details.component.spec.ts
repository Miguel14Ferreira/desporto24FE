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
      ['detail', 'join', 'leave', 'messages', 'postMessage', 'participants', 'removeParticipant']
    );
    sessionService.detail.and.returnValue(of(session));
    sessionService.join.and.returnValue(of({
      state: 'PARTICIPANT',
      waitlistPosition: null
    }));
    sessionService.leave.and.returnValue(of(void 0));
    sessionService.removeParticipant.and.returnValue(of(void 0));
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

  it('should build calendar links with the session start and safe location', () => {
    const googleUrl = component.googleCalendarUrl();
    const outlookUrl = component.outlookCalendarUrl();

    expect(googleUrl).toContain('calendar.google.com/calendar/render');
    expect(googleUrl).toContain('dates=20261001T180000Z');
    expect(decodeURIComponent(googleUrl ?? '')).toContain('location=Lisboa');

    expect(outlookUrl).toContain('outlook.live.com/calendar');
    expect(decodeURIComponent(outlookUrl ?? '')).toContain('startdt=2026-10-01T18:00:00.000Z');
    expect(decodeURIComponent(outlookUrl ?? '')).toContain('location=Lisboa');
  });

  it('should prefer the exact address in calendar exports when it is visible', () => {
    component.session = {
      ...session,
      canSeeExactAddress: true,
      address: 'Rua do Campo, 10'
    };

    const ics = component.calendarIcsContent();

    expect(ics).toContain('DTSTART:20261001T180000Z');
    expect(ics).toContain('SUMMARY:Desporto24 — Padel');
    expect(ics).toContain('LOCATION:Rua do Campo\\, 10');
  });

  it('should join the session and refresh its details', () => {
    component.joinSession();

    expect(sessionService.join).toHaveBeenCalledWith(7, '');
    expect(sessionService.detail).toHaveBeenCalledTimes(2);
    expect(component.actionSuccess).toContain('sucesso');
  });

  it('should leave a waitlisted session and refresh details', () => {
    component.session = {
      ...session,
      waitlisted: true,
      waitlistPosition: 2
    };

    component.leaveSession();

    expect(sessionService.leave).toHaveBeenCalledWith(7);
    expect(sessionService.detail).toHaveBeenCalledTimes(2);
    expect(component.actionSuccess).toContain('lista de espera');
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

  it('should remove a non-creator participant and refresh the session', () => {
    (component as any).currentUsername = 'creator-user';
    component.session = {
      ...session,
      creatorUsername: 'creator-user',
      joined: true
    };
    const participant = {
      id: 15,
      username: 'player-one',
      attendanceStatus: 'PENDING',
      joinedAt: '2026-09-20T18:00:00Z'
    } as any;

    component.requestRemoveParticipant(participant);
    component.confirmRemoveParticipant(participant);

    expect(sessionService.removeParticipant).toHaveBeenCalledWith(7, 15);
    expect(component.participantManagementSuccess).toContain('removido');
    expect(component.pendingRemovalId).toBeNull();
  });

  it('should never offer removal for the session creator', () => {
    component.session = {
      ...session,
      creatorUsername: 'creator-user'
    };
    const creatorParticipant = {
      id: 1,
      username: 'creator-user',
      attendanceStatus: 'PENDING',
      joinedAt: '2026-09-20T18:00:00Z'
    } as any;

    expect(component.canRemoveParticipant(creatorParticipant)).toBeFalse();
  });

  it('should block attendance during the 30 minute post-start delay', () => {
    (component as any).currentUsername = 'creator-user';
    component.session = {
      ...session,
      gameDate: new Date(Date.now() - (29 * 60 * 1000)).toISOString(),
      joined: true
    };
    const participant = {
      id: 15,
      username: 'player-one',
      attendanceStatus: 'PENDING',
      joinedAt: '2026-09-20T18:00:00Z'
    } as any;

    component.recordAttendance(participant, 'NO_SHOW');

    expect(reliabilityService.recordAttendance).not.toHaveBeenCalled();
    expect(component.attendanceError).toContain('30 minutos');
    expect(participant.attendanceStatus).toBe('PENDING');
  });

  it('should record participant attendance after the 30 minute delay', () => {
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
