import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { BehaviorSubject, Subject, of, throwError } from 'rxjs';

import { SessionDetailsComponent } from './session-details.component';
import { SessionService } from '../../services/session.service';
import { ReliabilityService } from '../../services/reliability.service';
import { DirectChatRealtimeService } from '../../services/direct-chat-realtime.service';
import { SessionMessage } from '../model/session-message';
import { TEST_IMPORTS, TEST_PROVIDERS } from '../../testing/test-providers';

describe('SessionDetailsComponent', () => {
  let component: SessionDetailsComponent;
  let fixture: ComponentFixture<SessionDetailsComponent>;
  let sessionService: jasmine.SpyObj<SessionService>;
  let reliabilityService: jasmine.SpyObj<ReliabilityService>;
  let realtimeService: jasmine.SpyObj<DirectChatRealtimeService>;
  let realtimeSessionMessages: Subject<SessionMessage>;
  let realtimeConnected: BehaviorSubject<boolean>;

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
      ['detail', 'join', 'leave', 'complete', 'reportDidNotOccur', 'reportProblem', 'messages', 'postMessage', 'participants', 'removeParticipant', 'teamSuggestion', 'confirmTeams']
    );
    sessionService.detail.and.returnValue(of(session));
    sessionService.join.and.returnValue(of({
      state: 'PARTICIPANT',
      waitlistPosition: null
    }));
    sessionService.leave.and.returnValue(of(void 0));
    sessionService.complete.and.returnValue(of(void 0));
    sessionService.reportDidNotOccur.and.returnValue(of(void 0));
    sessionService.reportProblem.and.returnValue(of(void 0));
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
    sessionService.teamSuggestion.and.returnValue(of({
      teamA: [
        { username: 'creator-user', strengthScore: 2.8, statsAvailable: true, games: 8, wins: 5, goals: 6, assists: 2 }
      ],
      teamB: [
        { username: 'player-one', strengthScore: 2.7, statsAvailable: true, games: 8, wins: 4, goals: 7, assists: 1 }
      ],
      teamAScore: 2.8,
      teamBScore: 2.7,
      playersWithStats: 2,
      totalPlayers: 2
    }));
    sessionService.confirmTeams.and.returnValue(of({
      teamA: [
        { username: 'creator-user', strengthScore: 2.8, statsAvailable: true, games: 8, wins: 5, goals: 6, assists: 2 }
      ],
      teamB: [
        { username: 'player-one', strengthScore: 2.7, statsAvailable: true, games: 8, wins: 4, goals: 7, assists: 1 }
      ],
      teamAScore: 2.8,
      teamBScore: 2.7,
      playersWithStats: 2,
      totalPlayers: 2
    }));
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

    realtimeSessionMessages = new Subject<SessionMessage>();
    realtimeConnected = new BehaviorSubject<boolean>(false);
    realtimeService = jasmine.createSpyObj<DirectChatRealtimeService>(
      'DirectChatRealtimeService',
      ['connect', 'disconnect'],
      {
        sessionMessages$: realtimeSessionMessages.asObservable(),
        connected$: realtimeConnected.asObservable()
      }
    );

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
        },
        {
          provide: DirectChatRealtimeService,
          useValue: realtimeService
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

  it('should show a confirmed membership status linking to the participant list', () => {
    component.session = {
      ...session,
      joined: true,
      gameDate: new Date(Date.now() + 3600_000).toISOString()
    };
    fixture.detectChanges();

    const banner = fixture.nativeElement.querySelector('.membership-status') as HTMLElement;
    const participantLink = banner.querySelector('a') as HTMLAnchorElement;
    expect(banner.textContent).toContain('Já estás dentro');
    expect(participantLink.getAttribute('href')).toBe('#session-participants');
    expect(fixture.nativeElement.querySelector('#session-participants')).not.toBeNull();
  });

  it('should show the waitlist position in the membership status', () => {
    component.session = {
      ...session,
      waitlisted: true,
      waitlistPosition: 3,
      gameDate: new Date(Date.now() + 3600_000).toISOString()
    };
    fixture.detectChanges();

    const banner = fixture.nativeElement.querySelector('.membership-status.waitlisted') as HTMLElement;
    expect(banner.textContent).toContain('Lista de espera');
    expect(banner.textContent).toContain('na posição 3');
    expect(banner.querySelector('a')).toBeNull();
  });

  it('should not show a membership status to someone who has not joined', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.membership-status')).toBeNull();
  });

  it('offers a public share link only when the backend explicitly allows it', () => {
    component.session = { ...session, canSharePublicly: true };
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('.share-session-action') as HTMLButtonElement;
    expect(button).not.toBeNull();
    expect(button.textContent).toContain('Partilhar sessão');
    expect(component.publicShareUrl()).toBe(new URL('/sessions/7', window.location.origin).href);
  });

  it('does not offer public sharing when the backend has not provided permission', () => {
    fixture.detectChanges();

    expect(component.publicShareUrl()).toBeNull();
    expect(fixture.nativeElement.querySelector('.share-session-action')).toBeNull();
  });

  it('does not offer public sharing for private or community-only sessions', () => {
    for (const detail of [
      { privateGame: true, canSharePublicly: false },
      { audience: 'COMMUNITY_ONLY' as const, communityId: 12, canSharePublicly: false },
      { audience: 'PUBLIC' as const, canSharePublicly: false }
    ]) {
      component.session = { ...session, ...detail };
      fixture.detectChanges();
      expect(component.publicShareUrl()).toBeNull();
      expect(fixture.nativeElement.querySelector('.share-session-action')).toBeNull();
    }
  });

  it('allows sharing a community session explicitly made public by the backend', () => {
    component.session = {
      ...session, audience: 'PUBLIC', communityId: 12, canSharePublicly: true
    };
    fixture.detectChanges();

    expect(component.publicShareUrl()).toBe(new URL('/sessions/7', window.location.origin).href);
    expect(fixture.nativeElement.querySelector('.share-session-action')).not.toBeNull();
  });

  it('shows a selectable public link if sharing and clipboard access both fail', async () => {
    component.session = { ...session, canSharePublicly: true };
    if (typeof navigator.share === 'function') {
      spyOn(navigator, 'share').and.returnValue(Promise.reject(new Error('Not available')));
    }
    spyOn<any>(component, 'copyShareUrl').and.returnValue(Promise.reject(new Error('Clipboard denied')));

    await component.shareSession();
    fixture.detectChanges();

    const input = fixture.nativeElement.querySelector('#session-share-url') as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.readOnly).toBeTrue();
    expect(input.value).toBe(new URL('/sessions/7', window.location.origin).href);
    expect(component.shareFeedback).toContain('Seleciona a ligação');

    const selectSpy = spyOn(input, 'select').and.callThrough();
    const selectButton = fixture.nativeElement.querySelector('.manual-share-controls button') as HTMLButtonElement;
    selectButton.click();
    expect(selectSpy).toHaveBeenCalled();
  });

  it('confirms a successful copy without displaying the manual fallback', async () => {
    component.session = { ...session, canSharePublicly: true };
    if (typeof navigator.share === 'function') {
      spyOn(navigator, 'share').and.returnValue(Promise.reject(new Error('Not available')));
    }
    spyOn<any>(component, 'copyShareUrl').and.returnValue(Promise.resolve());

    await component.shareSession();
    fixture.detectChanges();

    expect(component.shareFeedback).toBe('Ligação copiada');
    expect(component.manualShareUrl).toBe('');
    expect(fixture.nativeElement.querySelector('.manual-share-link')).toBeNull();
  });

  it('should show a shortcut to the join action for a future open session', () => {
    component.session = {
      ...session,
      gameDate: new Date(Date.now() + 3600_000).toISOString()
    };
    fixture.detectChanges();

    const shortcut = fixture.nativeElement.querySelector('.join-shortcut') as HTMLAnchorElement;
    expect(shortcut).not.toBeNull();
    expect(shortcut.getAttribute('href')).toBe('#session-participation');
    expect(shortcut.textContent).toContain('Ver inscrição');
    expect(fixture.nativeElement.querySelector('#session-participation .join-controls .primary-action')).not.toBeNull();
    expect(sessionService.join).not.toHaveBeenCalled();
  });

  it('should point to the waitlist for a full session', () => {
    component.session = {
      ...session,
      status: 'FULL',
      participantCount: 4,
      gameDate: new Date(Date.now() + 3600_000).toISOString()
    };
    fixture.detectChanges();

    const shortcut = fixture.nativeElement.querySelector('.join-shortcut') as HTMLAnchorElement;
    expect(shortcut.textContent).toContain('lista de espera');
    expect(shortcut.getAttribute('href')).toBe('#session-participation');
  });

  it('should not show a join shortcut when a session is closed or already joined', () => {
    const gameDate = new Date(Date.now() + 3600_000).toISOString();
    for (const state of [
      { status: 'CANCELLED', joined: false },
      { status: 'COMPLETED', joined: false },
      { status: 'OPEN', joined: true }
    ]) {
      component.session = { ...session, ...state, gameDate };
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.join-shortcut')).toBeNull();
    }
  });

  it('should join the session and refresh its details', () => {
    component.session = { ...session, gameDate: new Date(Date.now() + 3600_000).toISOString() };
    component.joinSession();

    expect(sessionService.join).toHaveBeenCalledWith(7, '');
    expect(sessionService.detail).toHaveBeenCalledTimes(2);
    expect(component.actionSuccess).toContain('sucesso');
  });

  it('should allow joining the waitlist when a future session is full', () => {
    component.session = {
      ...session,
      status: 'FULL',
      participantCount: 4,
      gameDate: new Date(Date.now() + 3600_000).toISOString()
    };
    sessionService.join.and.returnValue(of({ state: 'WAITLISTED', waitlistPosition: 1 }));

    expect(component.canJoinSession()).toBeTrue();
    expect(component.joinButtonLabel()).toContain('lista de espera');
    component.joinSession();

    expect(sessionService.join).toHaveBeenCalledWith(7, '');
    expect(component.actionSuccess).toContain('lista de espera');
  });

  it('should hide new inscriptions for cancelled, completed and already started sessions', () => {
    const futureDate = new Date(Date.now() + 3600_000).toISOString();
    for (const closedCase of [
      { status: 'CANCELLED', gameDate: futureDate },
      { status: 'COMPLETED', gameDate: futureDate },
      { status: 'OPEN', gameDate: new Date(Date.now() - 3600_000).toISOString() }
    ]) {
      component.session = { ...session, ...closedCase };
      expect(component.canJoinSession()).toBeFalse();
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.join-controls .primary-action')).toBeNull();
      component.joinSession();
    }

    expect(sessionService.join).not.toHaveBeenCalled();
  });

  it('should not offer another inscription to an existing participant or waitlisted user', () => {
    const gameDate = new Date(Date.now() + 3600_000).toISOString();
    component.session = { ...session, joined: true, gameDate };
    expect(component.canJoinSession()).toBeFalse();
    component.joinSession();
    component.session = { ...session, waitlisted: true, gameDate };
    expect(component.canJoinSession()).toBeFalse();
    component.joinSession();
    expect(sessionService.join).not.toHaveBeenCalled();
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

  it('should report a selected problem for a started session and refresh details', () => {
    (component as any).currentUsername = 'creator-user';
    component.session = {
      ...session,
      joined: true,
      status: 'OPEN',
      gameDate: '2026-09-30T18:00:00Z'
    };
    component.selectedProblemType = 'VENUE_PROBLEM';
    component.problemDetails = '  Campo sem iluminação  ';

    component.reportProblem();

    expect(sessionService.reportProblem).toHaveBeenCalledWith(
      7,
      'VENUE_PROBLEM',
      'Campo sem iluminação'
    );
    expect(sessionService.detail).toHaveBeenCalledTimes(2);
    expect(component.showProblemReport).toBeFalse();
    expect(component.selectedProblemType).toBe('');
    expect(component.problemDetails).toBe('');
  });

  it('should reject problem details longer than 500 characters', () => {
    (component as any).currentUsername = 'creator-user';
    component.session = {
      ...session,
      joined: true,
      status: 'OPEN',
      gameDate: '2026-09-30T18:00:00Z'
    };
    component.selectedProblemType = 'OTHER';
    component.problemDetails = 'x'.repeat(501);

    component.reportProblem();

    expect(sessionService.reportProblem).not.toHaveBeenCalled();
    expect(component.actionError).toContain('500');
  });

  it('should label a previously reported session problem', () => {
    expect(component.problemTypeLabel('NOT_OCCURRED')).toContain('não aconteceu');
    expect(component.problemTypeLabel('VENUE_PROBLEM')).toContain('recinto');
    expect(component.problemTypeLabel('OTHER')).toContain('Outro');
  });

  it('should show reported problem details returned for the creator', () => {
    (component as any).currentUsername = 'creator-user';
    component.session = {
      ...session,
      joined: true,
      problemType: 'OTHER',
      problemDetails: 'Balneário sem água quente'
    };

    fixture.detectChanges();

    const reportedState = fixture.nativeElement.querySelector('.reported-problem-state');
    expect(reportedState?.textContent).toContain('Outro');
    expect(reportedState?.textContent).toContain('Balneário sem água quente');
  });

  it('should not allow another problem report after one is already registered', () => {
    (component as any).currentUsername = 'creator-user';
    component.session = {
      ...session,
      joined: true,
      status: 'OPEN',
      gameDate: '2026-09-30T18:00:00Z',
      problemType: 'VENUE_PROBLEM'
    };

    expect(component.canReportProblem()).toBeFalse();

    component.selectedProblemType = 'OTHER';
    component.reportProblem();

    expect(sessionService.reportProblem).not.toHaveBeenCalled();
  });

  it('should not allow problem reporting before the session starts', () => {
    (component as any).currentUsername = 'creator-user';
    component.session = {
      ...session,
      joined: true,
      status: 'OPEN',
      gameDate: '2099-10-01T18:00:00Z'
    };

    component.selectedProblemType = 'OTHER';
    component.reportProblem();

    expect(sessionService.reportProblem).not.toHaveBeenCalled();
  });

  it('should require a password for private sessions', () => {
    component.session = {
      ...session,
      gameDate: new Date(Date.now() + 3600_000).toISOString(),
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

  it('should append a realtime session message only once', () => {
    const message: SessionMessage = {
      id: 50,
      sessionId: 7,
      senderUsername: 'player-one',
      body: 'Estou a caminho',
      createdAt: '2026-10-01T16:05:00Z'
    };

    realtimeSessionMessages.next(message);
    realtimeSessionMessages.next(message);

    expect(component.messages).toEqual([message]);
  });

  it('should deduplicate the WebSocket echo from the HTTP send response', () => {
    const message: SessionMessage = {
      id: 1,
      sessionId: 7,
      senderUsername: 'fixture-user',
      body: 'Bora jogar!',
      createdAt: '2026-10-01T16:00:00Z'
    };
    component.session = {
      ...session,
      joined: true
    };
    component.messageBody = 'Bora jogar!';

    realtimeSessionMessages.next(message);
    component.sendMessage();

    expect(sessionService.postMessage).toHaveBeenCalledWith(7, 'Bora jogar!');
    expect(component.messages).toEqual([message]);
  });

  it('should let a joined non-creator view who is going', () => {
    sessionService.participants.calls.reset();
    (component as any).currentUsername = 'player-one';
    component.session = {
      ...session,
      joined: true,
      creatorUsername: 'creator-user'
    };

    component.loadSessionParticipants();

    expect(sessionService.participants).toHaveBeenCalledWith(7);
    expect(component.sessionParticipants.length).toBe(1);
    expect(component.sessionParticipants[0].username).toBe('player-one');
  });

  it('should not load the visible participant list for outsiders', () => {
    sessionService.participants.calls.reset();
    component.session = {
      ...session,
      joined: false
    };

    component.loadSessionParticipants();

    expect(sessionService.participants).not.toHaveBeenCalled();
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

  it('should generate balanced teams for a full community session created by the viewer', () => {
    (component as any).currentUsername = 'creator-user';
    component.session = {
      ...session,
      creatorUsername: 'creator-user',
      joined: true,
      communityId: 9,
      participantCount: 4,
      maxParticipants: 4,
      status: 'FULL'
    };

    expect(component.canGenerateTeams()).toBeTrue();

    component.generateTeams();

    expect(sessionService.teamSuggestion).toHaveBeenCalledWith(7);
    expect(component.teamSuggestion?.teamA[0].username).toBe('creator-user');
    expect(component.teamSuggestion?.playersWithStats).toBe(2);
    expect(component.teamSuggestionPendingConfirmation).toBeTrue();
  });

  it('should confirm generated teams and refresh participant assignments', () => {
    (component as any).currentUsername = 'creator-user';
    component.session = {
      ...session,
      creatorUsername: 'creator-user',
      joined: true,
      communityId: 9,
      participantCount: 4,
      maxParticipants: 4,
      status: 'FULL'
    };
    component.teamSuggestion = {
      teamA: [
        { username: 'creator-user', strengthScore: 2.8, statsAvailable: true, games: 8, wins: 5, goals: 6, assists: 2 }
      ],
      teamB: [
        { username: 'player-one', strengthScore: 2.7, statsAvailable: true, games: 8, wins: 4, goals: 7, assists: 1 }
      ],
      teamAScore: 2.8,
      teamBScore: 2.7,
      playersWithStats: 2,
      totalPlayers: 2
    };
    component.teamSuggestionPendingConfirmation = true;
    sessionService.participants.and.returnValue(of([
      {
        id: 1,
        username: 'creator-user',
        attendanceStatus: 'PENDING',
        joinedAt: '2026-09-20T18:00:00Z',
        teamCode: 'A'
      },
      {
        id: 15,
        username: 'player-one',
        attendanceStatus: 'PENDING',
        joinedAt: '2026-09-20T18:00:00Z',
        teamCode: 'B'
      }
    ]));

    component.confirmTeams();

    expect(sessionService.confirmTeams).toHaveBeenCalledWith(7);
    expect(component.teamsSuccess).toContain('confirmadas');
    expect(component.teamSuggestionPendingConfirmation).toBeFalse();
    expect(component.hasConfirmedTeams()).toBeTrue();
    expect(component.teamParticipants('A')[0].username).toBe('creator-user');
  });

  it('should not confirm the same team suggestion twice', () => {
    (component as any).currentUsername = 'creator-user';
    component.session = {
      ...session,
      creatorUsername: 'creator-user',
      joined: true,
      communityId: 9,
      participantCount: 4,
      maxParticipants: 4,
      status: 'FULL'
    };
    component.teamSuggestion = {
      teamA: [],
      teamB: [],
      teamAScore: 0,
      teamBScore: 0,
      playersWithStats: 0,
      totalPlayers: 4
    };
    component.teamSuggestionPendingConfirmation = false;

    component.confirmTeams();

    expect(sessionService.confirmTeams).not.toHaveBeenCalled();
  });

  it('should not offer team generation outside community sessions', () => {
    (component as any).currentUsername = 'creator-user';
    component.session = {
      ...session,
      creatorUsername: 'creator-user',
      joined: true,
      participantCount: 4,
      maxParticipants: 4,
      status: 'FULL',
      communityId: null
    };

    expect(component.canGenerateTeams()).toBeFalse();

    component.generateTeams();

    expect(sessionService.teamSuggestion).not.toHaveBeenCalled();
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

  it('should not allow attendance management for a cancelled session', () => {
    (component as any).currentUsername = 'creator-user';
    component.session = {
      ...session,
      status: 'CANCELLED',
      joined: true,
      gameDate: '2020-10-01T18:00:00Z'
    };

    expect(component.canRecordAttendance()).toBeFalse();

    component.toggleAttendanceManager();

    expect(component.showAttendanceManager).toBeFalse();
    expect(sessionService.participants).not.toHaveBeenCalled();
  });

  it('should hide attendance management before the 30 minute delay', () => {
    (component as any).currentUsername = 'creator-user';
    component.session = {
      ...session,
      joined: true,
      gameDate: new Date(Date.now() - (29 * 60 * 1000)).toISOString()
    };

    fixture.detectChanges();

    expect(component.canRecordAttendance()).toBeFalse();
    expect(fixture.nativeElement.querySelector('.attendance-panel')).toBeNull();
  });

  it('should not load participants until attendance management is opened', () => {
    sessionService.participants.calls.reset();
    (component as any).currentUsername = 'creator-user';
    component.session = {
      ...session,
      joined: true,
      gameDate: '2020-10-01T18:00:00Z'
    };
    component.participants = [];

    expect(sessionService.participants).not.toHaveBeenCalled();

    component.toggleAttendanceManager();

    expect(sessionService.participants).toHaveBeenCalledWith(7);
  });

  it('should keep post-session attendance management collapsed until requested', () => {
    (component as any).currentUsername = 'creator-user';
    component.session = {
      ...session,
      joined: true,
      gameDate: '2020-10-01T18:00:00Z'
    };

    expect(component.canRecordAttendance()).toBeTrue();
    expect(component.showAttendanceManager).toBeFalse();

    component.toggleAttendanceManager();

    expect(component.showAttendanceManager).toBeTrue();
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

  it('should expose a recoverable error when session details fail to load', () => {
    sessionService.detail.and.returnValue(
      throwError(() => new Error('API unavailable'))
    );

    component.retrySessionLoad();

    expect(component.loading).toBeFalse();
    expect(component.errorMessage).toContain('detalhes');
  });

  it('should clear the load error when retrying session details successfully', () => {
    component.errorMessage = 'temporary error';
    sessionService.detail.and.returnValue(of(session));

    component.retrySessionLoad();

    expect(component.errorMessage).toBe('');
    expect(component.session?.id).toBe(7);
  });
});
