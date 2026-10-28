import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, Subject, of, throwError } from 'rxjs';

import { SessionDetailsComponent } from './session-details.component';
import { CommunityService } from '../../services/community.service';
import { DirectChatService } from '../../services/direct-chat.service';
import { SessionService } from '../../services/session.service';
import { ReliabilityService } from '../../services/reliability.service';
import { DirectChatRealtimeService } from '../../services/direct-chat-realtime.service';
import { ChatReadSyncService } from '../../services/chat-read-sync.service';
import { SessionMessage } from '../model/session-message';
import { TEST_IMPORTS, TEST_PROVIDERS } from '../../testing/test-providers';
import { ChatReactionsStubComponent } from '../../testing/chat-reactions-stub.component';
import { I18nService } from '../../i18n/i18n.service';

describe('SessionDetailsComponent', () => {
  let component: SessionDetailsComponent;
  let fixture: ComponentFixture<SessionDetailsComponent>;
  let sessionService: jasmine.SpyObj<SessionService>;
  let communityService: jasmine.SpyObj<CommunityService>;
  let directChatService: jasmine.SpyObj<DirectChatService>;
  let reliabilityService: jasmine.SpyObj<ReliabilityService>;
  let realtimeService: jasmine.SpyObj<DirectChatRealtimeService>;
  let realtimeSessionMessages: Subject<SessionMessage>;
  let realtimeConnected: BehaviorSubject<boolean>;
  let readSync: jasmine.SpyObj<ChatReadSyncService>;

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

  /** Private rating controls are available only to confirmed session attendees. */
  function confirmRatingAttendance(username?: string): void {
    const identity = username ?? (component as any).currentUsername ?? 'player-one';
    (component as any).currentUsername = identity;
    component.sessionParticipants = [{
      id: 15,
      username: identity,
      attendanceStatus: 'ATTENDED',
      joinedAt: '2026-09-20T18:00:00Z'
    }];
  }

  beforeEach(async () => {
    readSync = jasmine.createSpyObj<ChatReadSyncService>('ChatReadSyncService', ['markVisible']);
    communityService = jasmine.createSpyObj<CommunityService>('CommunityService', ['friends']);
    communityService.friends.and.returnValue(of([{username:'player-two', fullName: 'Player Two', nickname: null, profilePicUrl: null, chatBlocked: false, blockedByMe: false}]));
    directChatService = jasmine.createSpyObj<DirectChatService>('DirectChatService', ['send']);
    directChatService.send.and.returnValue(of({} as any));
    sessionService = jasmine.createSpyObj<SessionService>(
      'SessionService',
      ['detail', 'join', 'leave', 'complete', 'reportDidNotOccur', 'reportProblem', 'messages', 'postMessage', 'participants', 'removeParticipant', 'teamSuggestion', 'confirmTeams', 'futureExclusionStatus', 'excludeFromFutureSessions', 'allowFutureSessions', 'myOverallRating', 'rateOverall', 'myVenueRating', 'rateVenue', 'sentCompliments', 'receivedCompliments', 'giveCompliment', 'issueGuestLink', 'guestRequests', 'reviewGuestRequest', 'cancelGuestRequest']
    );
    sessionService.detail.and.returnValue(of(session));
    sessionService.guestRequests.and.returnValue(of([]));
    sessionService.issueGuestLink.and.returnValue(of({token:'T'.repeat(43)}));
    sessionService.cancelGuestRequest.and.returnValue(of({id:30,name:'Convidado',status:'CANCELLED',note:'',teamCode:null}));
    sessionService.join.and.returnValue(of({
      state: 'PARTICIPANT',
      waitlistPosition: null
    }));
    sessionService.leave.and.returnValue(of(void 0));
    sessionService.complete.and.returnValue(of(void 0));
    sessionService.reportDidNotOccur.and.returnValue(of(void 0));
    sessionService.reportProblem.and.returnValue(of(void 0));
    sessionService.removeParticipant.and.returnValue(of(void 0));
    sessionService.futureExclusionStatus.and.returnValue(of({ excluded: false }));
    sessionService.excludeFromFutureSessions.and.returnValue(of({ excluded: true }));
    sessionService.allowFutureSessions.and.returnValue(of({ excluded: false }));
    sessionService.myOverallRating.and.returnValue(of(null));
    sessionService.myVenueRating.and.returnValue(of(null));
    sessionService.rateVenue.and.returnValue(of({
      venueId: 100, score: 4, updatedAt: '2026-10-22T10:00:00Z'
    }));
    sessionService.rateOverall.and.returnValue(of({
      overallScore: 5, updatedAt: '2026-10-13T10:00:00Z'
    }));
    sessionService.sentCompliments.and.returnValue(of([]));
    sessionService.receivedCompliments.and.returnValue(of([]));
    sessionService.giveCompliment.and.returnValue(of({
      senderUsername: 'player-one',
      recipientUsername: 'player-two',
      type: 'FAIR_PLAY',
      updatedAt: '2026-10-22T10:00:00Z'
    }));
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
      imports: [...TEST_IMPORTS, ChatReactionsStubComponent],
      providers: [
        ...TEST_PROVIDERS,
        { provide: ChatReadSyncService, useValue: readSync },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ id: '7' }),
              queryParamMap: convertToParamMap({})
            }
          }
        },
        {
          provide: SessionService,
          useValue: sessionService
        },
        { provide: CommunityService, useValue: communityService },
        { provide: DirectChatService, useValue: directChatService },
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

  it('returns to Discover with original filters without forwarding join action', () => {
    const route = TestBed.inject(ActivatedRoute);
    Object.defineProperty(route.snapshot, 'queryParamMap', {
      configurable: true,
      value: convertToParamMap({
        from: 'discover', sport: 'Ténis', city: 'Sintra', player: 'Ana', join: '1'
      })
    });
    fixture.detectChanges();

    const back = fixture.nativeElement.querySelector('.back-link') as HTMLAnchorElement;
    const url = new URL(back.getAttribute('href')!, 'https://jynlo.test');
    expect(url.pathname).toBe('/menu/discover');
    expect(url.searchParams.get('sport')).toBe('Ténis');
    expect(url.searchParams.get('city')).toBe('Sintra');
    expect(url.searchParams.get('player')).toBe('Ana');
    expect(url.searchParams.has('join')).toBeFalse();
    expect(back.textContent).toContain('Voltar ao Descobrir');
    expect(sessionService.join).not.toHaveBeenCalled();
  });

  it('ignores untrusted return origins and keeps the default sessions destination', () => {
    const route = TestBed.inject(ActivatedRoute);
    Object.defineProperty(route.snapshot, 'queryParamMap', {
      configurable: true,
      value: convertToParamMap({
        from: 'https://untrusted.example/', sport: 'Ténis', join: '1'
      })
    });
    fixture.detectChanges();
    const back = fixture.nativeElement.querySelector('.back-link') as HTMLAnchorElement;
    expect(back.getAttribute('href')).toBe('/menu/events');
    expect(back.textContent).toContain('Voltar às sessões');
    expect(sessionService.join).not.toHaveBeenCalled();
  });

  it('keeps session detail navigation and participation information inside the Premium shell', () => {
    const shell: HTMLElement = fixture.nativeElement.querySelector('.detail-page');
    expect(shell.classList.contains('jynlo-session-detail-premium')).toBeTrue();
    expect(shell.classList.contains('jynlo-games')).toBeTrue();
    expect(shell.querySelector('a.back-link[href="/menu/events"]')).toBeTruthy();
    expect(shell.querySelector('.detail-card .title-row h1')?.textContent).toContain('Lisboa');
    expect(shell.querySelector('.detail-card .detail-grid')).toBeTruthy();
    expect(shell.querySelector('.session-top-actions')).toBeTruthy();
    expect(shell.querySelector('.detail-grid')?.textContent).toContain('2/4');
  });

  it('gives back navigation and membership blocks consistent Premium breathing room', () => {
    component.session = { ...session, joined: true };
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const back = root.querySelector<HTMLElement>('.jynlo-session-detail-premium .detail-shell > .back-link');
    const membership = root.querySelector<HTMLElement>('.detail-content > .membership-status');
    const actions = root.querySelector<HTMLElement>('.detail-content > .session-top-actions');
    expect(back).not.toBeNull();
    expect(membership).not.toBeNull();
    expect(actions).not.toBeNull();
    const expected = matchMedia('(max-width: 760px)').matches ? '20px' : '24px';
    expect(getComputedStyle(back!).marginBottom).toBe(expected);
    expect(getComputedStyle(membership!).marginTop).toBe(expected);
    expect(getComputedStyle(actions!).marginTop).toBe(expected);
  });

  it('retains confirmed and waitlisted membership badges with Premium styling', () => {
    component.session = { ...session, joined: true, waitlisted: false };
    fixture.detectChanges();
    let membership: HTMLElement = fixture.nativeElement.querySelector('.jynlo-session-detail-premium .membership-status');
    expect(membership).toBeTruthy();
    expect(membership.classList.contains('waitlisted')).toBeFalse();
    expect(membership.querySelector('.participants-shortcut')).toBeTruthy();

    component.session = { ...session, joined: false, waitlisted: true, waitlistPosition: 3 };
    fixture.detectChanges();
    membership = fixture.nativeElement.querySelector('.jynlo-session-detail-premium .membership-status');
    expect(membership.classList.contains('waitlisted')).toBeTrue();
    expect(membership.textContent).toContain('3');
    expect(membership.querySelector('.participants-shortcut')).toBeNull();
  });

  it('offers a jump to new session messages without moving the scroll until chosen', () => {
    component.session = { ...session, joined: true };
    const log = { scrollHeight: 900, scrollTop: 60, clientHeight: 260 };
    component.chatMessageList = { nativeElement: log } as any;
    realtimeSessionMessages.next({ id: 91, sessionId: 7, senderUsername: 'player-two',
      body: 'Vamos!', createdAt: '2026-10-23T09:00:00Z' });
    expect(component.newMessagesPending).toBe(1);
    expect(log.scrollTop).toBe(60);
    component.jumpToLatestMessages();
    expect(log.scrollTop).toBe(900);
    expect(component.newMessagesPending).toBe(0);
  });

  it('only synchronizes session chat reads after access is granted and messages have loaded', () => {
    component.messages = [{
      id: 29, sessionId: 7, senderUsername: 'creator-user',
      body: 'Olá', createdAt: '2026-10-23T09:00:00Z'
    }];
    component.onSessionChatScroll();
    expect(readSync.markVisible).not.toHaveBeenCalled();

    component.session = { ...session, joined: true };
    fixture.detectChanges();
    readSync.markVisible.calls.reset();
    component.onSessionChatScroll();
    expect(readSync.markVisible).not.toHaveBeenCalled(); // No chat log on session details.

    readSync.markVisible.calls.reset();
    component.chatError = 'Sem autorização';
    component.onSessionChatScroll();
    expect(readSync.markVisible).not.toHaveBeenCalled();
  });

  it('keeps a confirmed membership visible if the details refresh fails after POST', () => {
    component.session = { ...session, gameDate: new Date(Date.now() + 3600_000).toISOString() };
    sessionService.detail.and.returnValue(throwError(() => new HttpErrorResponse({ status: 503 })));
    expect(component.canJoinSession()).toBeTrue();

    component.joinSession();
    fixture.detectChanges();

    expect(sessionService.join).toHaveBeenCalledTimes(1);
    expect(component.session?.joined).toBeTrue();
    expect(component.canJoinSession()).toBeFalse();
    expect(component.actionSuccess).toBeTruthy();
    expect(component.errorMessage).toBe('');
    expect(component.detailRefreshWarning).toBeTruthy();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(component.detailRefreshWarning);
  });

  it('blocks duplicate POST after a network failure until GET confirms membership', () => {
    component.session = { ...session, gameDate: new Date(Date.now() + 3600_000).toISOString() };
    sessionService.join.and.returnValue(throwError(() => new HttpErrorResponse({ status: 0 })));
    sessionService.detail.and.returnValue(throwError(() => new HttpErrorResponse({ status: 503 })));

    component.joinSession();
    fixture.detectChanges();

    expect(component.joinOutcomeUnknown).toBeTrue();
    expect(component.canJoinSession()).toBeFalse();
    expect(component.joinStatusMessage).toBeTruthy();
    expect((fixture.nativeElement as HTMLElement).querySelector('.participation-panel button')).not.toBeNull();
    component.joinSession();
    expect(sessionService.join).toHaveBeenCalledTimes(1);

    sessionService.detail.and.returnValue(of({ ...session, joined: true }));
    component.verifyJoinOutcome();
    fixture.detectChanges();

    expect(component.joinOutcomeUnknown).toBeFalse();
    expect(component.session?.joined).toBeTrue();
    expect(component.actionSuccess).toBeTruthy();
    expect(sessionService.join).toHaveBeenCalledTimes(1);
  });

  it('treats an explicit invalid request as rejected without showing uncertain state', () => {
    component.session = { ...session, gameDate: new Date(Date.now() + 3600_000).toISOString() };
    sessionService.join.and.returnValue(throwError(() => new HttpErrorResponse({
      status: 403, error: { message: 'Não autorizado' }
    })));
    component.joinSession();
    expect(component.joinOutcomeUnknown).toBeFalse();
    expect(component.actionError).toContain('Não autorizado');
    expect(sessionService.detail).toHaveBeenCalledTimes(1); // ngOnInit only
  });

  it('opens a shared session when the lazy route keeps its id on the parent snapshot', () => {
    const route = TestBed.inject(ActivatedRoute) as any;
    route.snapshot.paramMap = convertToParamMap({});
    route.parent = { snapshot: { paramMap: convertToParamMap({ id: '53' }) } };
    sessionService.detail.calls.reset();

    component.ngOnInit();

    expect(sessionService.detail).toHaveBeenCalledWith(53);
    expect(component.errorMessage).toBe('');
  });

  it('opens only an authorised exact address in Google Maps', () => {
    component.session = {
      ...session, address: 'Rua Machado dos Santos, Parede',
      canSeeExactAddress: true,
      venue: { latitude: 38.7, longitude: -9.36 } as any
    };
    fixture.detectChanges();
    const link = fixture.nativeElement.querySelector('.session-location-map') as HTMLAnchorElement;
    expect(link).not.toBeNull();
    expect(new URL(link.href).hostname).toBe('www.google.com');
    expect(new URL(link.href).searchParams.get('query')).toBe('38.7,-9.36');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');

    component.session = { ...session, address: 'Rua Machado dos Santos, Parede', canSeeExactAddress: false };
    fixture.detectChanges();
    expect(component.exactGoogleMapsUrl()).toBeNull();
    expect(fixture.nativeElement.querySelector('.session-location-map')).toBeNull();
    expect(fixture.nativeElement.querySelector('.address-panel').textContent)
      .not.toContain('Rua Machado dos Santos');
  });

  it('lets an authorised player navigate to a GPS-only venue with no postal address', () => {
    component.session = {
      ...session,
      canSeeExactAddress: true,
      address: null,
      venue: { id: 447, latitude: 40.6668823, longitude: -8.7391574,
        locationStatus: 'GPS_ONLY_ADDRESS_UNKNOWN', address: '' } as any
    };
    fixture.detectChanges();
    const link = fixture.nativeElement.querySelector('.session-location-map') as HTMLAnchorElement;
    expect(link).not.toBeNull();
    expect(new URL(link.href).searchParams.get('query')).toBe('40.6668823,-8.7391574');
    expect(link.textContent?.trim()).toBeTruthy();
    expect(link.textContent).not.toContain('null');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('offers driving, walking and transit only to viewers authorised to see venue GPS', () => {
    component.session = {
      ...session, canSeeExactAddress: true, address: null,
      venue: { id: 447, latitude: 40.6668823, longitude: -8.7391574,
        locationStatus: 'GPS_ONLY_ADDRESS_UNKNOWN', address: '' } as any
    };
    fixture.detectChanges();
    const links = Array.from(fixture.nativeElement.querySelectorAll(
      '.session-route-mode')) as HTMLAnchorElement[];
    expect(links.length).toBe(3);
    expect(links.map(a => new URL(a.href).searchParams.get('travelmode')))
      .toEqual(['driving', 'walking', 'transit']);
    links.forEach(a => {
      const url = new URL(a.href);
      expect(url.searchParams.get('destination')).toBe('40.6668823,-8.7391574');
      expect(url.searchParams.has('origin')).toBeFalse();
      expect(a.rel).toContain('noopener');
      expect(a.target).toBe('_blank');
    });

    component.session = { ...component.session, canSeeExactAddress: false };
    fixture.detectChanges();
    expect(component.exactDirectionsUrl('driving')).toBeNull();
    expect(fixture.nativeElement.querySelector('.session-route-planner')).toBeNull();
  });

  it('does not show false turn-by-turn directions for unknown or invalid GPS', () => {
    component.session = {
      ...session, canSeeExactAddress: true, address: 'Rua do Campo 10',
      venue: { id: 447, latitude: 0, longitude: 0 } as any
    };
    fixture.detectChanges();
    expect(component.exactDirectionsUrl('walking')).toBeNull();
    expect(fixture.nativeElement.querySelector('.session-route-mode')).toBeNull();
    expect(fixture.nativeElement.querySelector('.session-location-map')).not.toBeNull();
  });

  it('does not leak GPS-only coordinates to an unauthorised session viewer', () => {
    component.session = {
      ...session,
      canSeeExactAddress: false,
      address: null,
      venue: { id: 447, latitude: 40.6668823, longitude: -8.7391574,
        locationStatus: 'GPS_ONLY_ADDRESS_UNKNOWN', address: '' } as any
    };
    fixture.detectChanges();
    expect(component.exactGoogleMapsUrl()).toBeNull();
    expect(fixture.nativeElement.querySelector('.session-location-map')).toBeNull();
    expect(fixture.nativeElement.querySelector('.address-panel').textContent)
      .not.toContain('-8.7391574');
  });

  it('does not turn an OSM coordinate placeholder into a confirmed postal address', () => {
    component.session = {
      ...session,
      canSeeExactAddress: true,
      address: 'Coordenadas (morada por confirmar)',
      venue: { id: 447, latitude: 40.6668823, longitude: -8.7391574,
        locationStatus: 'GPS_ONLY_ADDRESS_UNKNOWN', address: '' } as any
    };
    fixture.detectChanges();
    const link = fixture.nativeElement.querySelector('.session-location-map') as HTMLAnchorElement;
    expect(link).not.toBeNull();
    expect(new URL(link.href).searchParams.get('query')).toBe('40.6668823,-8.7391574');
    expect(link.textContent).not.toContain('Coordenadas (morada por confirmar)');
  });

  it('preserves address-based Maps search when there is no venue GPS', () => {
    component.session = { ...session, canSeeExactAddress: true,
      address: 'Rua do Campo, 12', city: 'Lisboa', venue: null };
    fixture.detectChanges();
    const link = fixture.nativeElement.querySelector('.session-location-map') as HTMLAnchorElement;
    expect(new URL(link.href).searchParams.get('query')).toBe('Rua do Campo, 12, Lisboa');

    component.session = { ...session, canSeeExactAddress: true, address: null, venue: null };
    fixture.detectChanges();
    expect(component.exactGoogleMapsUrl()).toBeNull();
    expect(fixture.nativeElement.querySelector('.session-location-map')).toBeNull();
  });

  it('rejects (0,0) GPS pins and distinguishes missing from locked locations', () => {
    component.session = {
      ...session, canSeeExactAddress: true, address: null,
      venue: { id: 447, latitude: 0, longitude: 0 } as any
    };
    fixture.detectChanges();
    expect(component.exactGoogleMapsUrl()).toBeNull();
    expect(fixture.nativeElement.querySelector('.session-location-map')).toBeNull();
    expect(fixture.nativeElement.querySelector('.address-panel').textContent)
      .toContain('Localização exata ainda não disponível');
  });

  it('shows a reference GPS point for authorised island session players', () => {
    component.session = {
      ...session, canSeeExactAddress: true, address: null,
      venue: { id: 447, name: 'Pavilhão da Ilha', city: 'Ponta Delgada',
        latitude: 37.741, longitude: -25.675,
        locationStatus: 'GPS_ONLY_ADDRESS_UNKNOWN' } as any
    };
    fixture.detectChanges();
    const url = component.exactGoogleMapsUrl();
    expect(new URL(url!).searchParams.get('query')).toBe('37.741,-25.675');
    expect(new URL(component.googleCalendarUrl()!).searchParams.get('location'))
      .toBe('37.741,-25.675');
    expect(fixture.nativeElement.querySelector('.address-panel').textContent)
      .toContain('não é necessariamente a entrada');
  });

  it('does not search Maps using old placeholder coordinates as street text', () => {
    component.session = {
      ...session, canSeeExactAddress: true,
      address: 'Coordenadas (morada por confirmar)',
      venue: { id: 447, latitude: 0, longitude: 0 } as any
    };
    fixture.detectChanges();
    expect(component.exactGoogleMapsUrl()).toBeNull();
    expect(component.exactLocationLabel()).not.toContain('morada por confirmar');
    expect(component.calendarIcsContent()).toContain('LOCATION:Lisboa');
  });

  it('does not expose Madeira venue coordinates in private session calendar links', () => {
    component.session = {
      ...session, canSeeExactAddress: false, address: 'Rua Privada 9',
      venue: { id: 447, latitude: 32.648, longitude: -16.908 } as any
    };
    fixture.detectChanges();
    expect(component.hasVenueMapCoordinates()).toBeFalse();
    expect(component.exactGoogleMapsUrl()).toBeNull();
    expect(fixture.nativeElement.querySelector('.address-panel').textContent).not.toContain('-16.908');
    expect(new URL(component.googleCalendarUrl()!).searchParams.get('location')).toBe('Lisboa');
  });

  it('shares only concise game details and a public URL, without generic promotion', () => {
    (component as any).currentUsername = 'creator-user';
    component.session = {
      ...session, status: 'OPEN', canSharePublicly: true,
      gameDate: '2099-10-01T18:00:00Z'
    };
    const link = component.whatsappShareUrl()!;
    expect(link).not.toBeNull();
    const text = new URL(link).searchParams.get('text')!;
    expect(text).toContain('🎾 Padel');
    expect(text).toContain('📍 Lisboa');
    expect(text).toContain('👥 2 vagas');
    expect(text).toContain('/sessions/7');
    expect(text).not.toContain('Vem jogar connosco na Jynlo!');
  });

  it('sends a public session link to a selected friend only on explicit action', () => {
    (component as any).currentUsername = 'creator-user';
    component.session = {...session, gameDate:'2099-10-01T18:00:00Z', canSharePublicly: true};
    fixture.detectChanges();
    const open = fixture.nativeElement.querySelector('.session-player-search button') as HTMLButtonElement;
    expect(open).not.toBeNull();
    open.click();
    fixture.detectChanges();
    expect(directChatService.send).not.toHaveBeenCalled();
    const send = fixture.nativeElement.querySelector('.session-friend-invites button') as HTMLButtonElement;
    send.click();
    expect(directChatService.send).toHaveBeenCalledOnceWith('player-two',
      'Queres juntar-te ao nosso jogo de Padel? ' + new URL('/sessions/7', window.location.origin).href);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.session-friend-invites [role="status"]').textContent).toContain('player-two');
  });

  it('does not expose invitations on full or private sessions', () => {
    (component as any).currentUsername = 'creator-user';
    component.session = {...session, gameDate:'2099-10-01T18:00:00Z', privateGame:true, canSharePublicly: true};
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.session-friend-invites')).toBeNull();
    component.sendSessionInvite('player-two');
    expect(directChatService.send).not.toHaveBeenCalled();
  });

  it('offers optional post-game actions only to the organiser after two hours', () => {
    (component as any).currentUsername = 'creator-user';
    component.session = {
      ...session, joined: true,
      gameDate: new Date(Date.now() - 3 * 3600_000).toISOString()
    };
    fixture.detectChanges();
    expect(component.canReviewPostGame()).toBeTrue();
    expect(fixture.nativeElement.querySelector('#post-game-review')?.textContent)
      .toContain('Depois do jogo');
    expect(fixture.nativeElement.querySelector('#post-game-review')?.textContent)
      .toContain('Registar presenças');
    expect(fixture.nativeElement.querySelector('#post-game-review')?.textContent)
      .not.toContain('Sim, aconteceu');

    component.session = { ...component.session, status: 'COMPLETED' };
    fixture.detectChanges();
    expect(component.canReviewPostGame()).toBeFalse();
    expect(fixture.nativeElement.querySelector('#post-game-review')).toBeNull();

    component.session = { ...session, joined: true, gameDate: new Date().toISOString() };
    expect(component.canReviewPostGame()).toBeFalse();
    (component as any).currentUsername = 'another-user';
    component.session = { ...session, joined: true, gameDate: '2020-10-01T18:00:00Z' };
    expect(component.canReviewPostGame()).toBeFalse();
  });

  it('only completes the session when the organiser chooses to register attendance', () => {
    (component as any).currentUsername = 'creator-user';
    component.session = { ...session, joined: true, gameDate: '2020-10-01T18:00:00Z' };
    sessionService.detail.and.returnValue(of({ ...component.session, status: 'COMPLETED' as const }));

    expect(sessionService.complete).not.toHaveBeenCalled();
    component.openPostGameAttendance();

    expect(sessionService.complete).toHaveBeenCalledWith(7);
    expect(component.showAttendanceManager).toBeTrue();
    expect(sessionService.participants).toHaveBeenCalledWith(7);
    expect(component.session?.status).toBe('COMPLETED');
  });

  it('marks a game as not played without assigning absences', () => {
    (component as any).currentUsername = 'creator-user';
    component.session = { ...session, joined: true, gameDate: '2020-10-01T18:00:00Z' };
    sessionService.detail.and.returnValue(of({ ...component.session, status: 'CANCELLED' as const }));

    component.confirmGameDidNotHappen();

    expect(sessionService.reportDidNotOccur).toHaveBeenCalledWith(7);
    expect(component.session?.status).toBe('CANCELLED');
    expect(reliabilityService.recordAttendance).not.toHaveBeenCalled();
  });

  it('offers positive peer compliments only when both players attended', () => {
    (component as any).currentUsername = 'player-one';
    component.session = {
      ...session, joined: true,
      gameDate: new Date(Date.now() - 3 * 3600_000).toISOString()
    };
    confirmRatingAttendance('player-one');
    component.sessionParticipants.push({
      id: 16, username: 'player-two', attendanceStatus: 'PENDING', joinedAt: '2026-09-20T18:00:00Z'
    });
    fixture.detectChanges();
    expect(component.canOfferCompliments()).toBeFalse();
    expect(fixture.nativeElement.querySelector('.player-compliments-panel')).toBeNull();

    component.sessionParticipants[1].attendanceStatus = 'ATTENDED';
    fixture.detectChanges();
    expect(component.canOfferCompliments()).toBeTrue();
    expect(fixture.nativeElement.querySelector('.player-compliments-panel')).not.toBeNull();
    expect(sessionService.sentCompliments).not.toHaveBeenCalled();

    (fixture.nativeElement.querySelector('.compliments-toggle') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(sessionService.sentCompliments).toHaveBeenCalledOnceWith(7);
    expect(sessionService.receivedCompliments).toHaveBeenCalledOnceWith(7);
    expect(fixture.nativeElement.querySelectorAll('.player-compliment-choice').length).toBe(3);
  });

  it('submits username-based compliments without confusing participation IDs with profile IDs', () => {
    (component as any).currentUsername = 'player-one';
    component.session = {
      ...session, joined: true,
      gameDate: new Date(Date.now() - 3 * 3600_000).toISOString()
    };
    confirmRatingAttendance('player-one');
    component.sessionParticipants.push({
      id: 9999, username: 'player-two', attendanceStatus: 'ATTENDED', joinedAt: '2026-09-20T18:00:00Z'
    });
    sessionService.giveCompliment.and.returnValue(of({
      senderUsername: 'player-one', recipientUsername: 'player-two',
      type: 'GREAT_TEAMMATE', updatedAt: '2026-10-22T10:00:00Z'
    }));
    component.toggleCompliments();
    fixture.detectChanges();
    const choices = fixture.nativeElement.querySelectorAll('.player-compliment-choice') as NodeListOf<HTMLButtonElement>;
    choices[1].click();
    fixture.detectChanges();
    expect(sessionService.giveCompliment).toHaveBeenCalledOnceWith(7, 'player-two', 'GREAT_TEAMMATE');
    expect(component.myCompliment('player-two')?.type).toBe('GREAT_TEAMMATE');
    expect(fixture.nativeElement.querySelector('.player-compliment-choice.is-sent')).not.toBeNull();

    choices[1].click();
    expect(sessionService.giveCompliment).toHaveBeenCalledTimes(1);
  });

  it('shows only compliments received by the logged-in player', () => {
    (component as any).currentUsername = 'player-one';
    component.session = {
      ...session, joined: true,
      gameDate: new Date(Date.now() - 3 * 3600_000).toISOString()
    };
    confirmRatingAttendance('player-one');
    component.sessionParticipants.push({
      id: 16, username: 'player-two', attendanceStatus: 'ATTENDED', joinedAt: '2026-09-20T18:00:00Z'
    });
    sessionService.receivedCompliments.and.returnValue(of([{
      senderUsername: 'player-two', recipientUsername: 'player-one', type: 'FAIR_PLAY',
      updatedAt: '2026-10-22T10:00:00Z'
    }]));
    component.toggleCompliments();
    fixture.detectChanges();
    const received = fixture.nativeElement.querySelector('.compliments-received') as HTMLElement;
    expect(received).not.toBeNull();
    expect(received.textContent).toContain('player-two');
    expect(received.textContent).toContain('Fair play');
    expect(sessionService.receivedCompliments).toHaveBeenCalledOnceWith(7);
  });

  it('handles unavailable compliments API without submitting any feedback', () => {
    (component as any).currentUsername = 'player-one';
    component.session = {
      ...session, joined: true,
      gameDate: new Date(Date.now() - 3 * 3600_000).toISOString()
    };
    confirmRatingAttendance('player-one');
    component.sessionParticipants.push({
      id: 16, username: 'player-two', attendanceStatus: 'ATTENDED', joinedAt: '2026-09-20T18:00:00Z'
    });
    sessionService.sentCompliments.and.returnValue(throwError(() => new Error('offline')));
    component.toggleCompliments();
    fixture.detectChanges();
    expect(component.complimentsLoadedSessionId).toBeNull();
    expect(fixture.nativeElement.querySelector('.player-compliments-panel [role="alert"]')).not.toBeNull();
    expect(sessionService.giveCompliment).not.toHaveBeenCalled();
    sessionService.sentCompliments.and.returnValue(of([]));
    component.loadCompliments();
    fixture.detectChanges();
    expect(component.complimentsLoadedSessionId).toBe(7);
  });

  it('offers venue stars only after confirmed attendance at a registered venue', () => {
    (component as any).currentUsername = 'player-one';
    component.session = {
      ...session, joined: true,
      gameDate: new Date(Date.now() - 3 * 3600_000).toISOString(),
      venue: { id: 100, name: 'Recinto Jynlo', city: 'Lisboa' } as any
    };
    component.sessionParticipants = [{
      id: 15, username: 'player-one', attendanceStatus: 'PENDING',
      joinedAt: '2026-09-20T18:00:00Z'
    }];
    fixture.detectChanges();
    expect(component.canRateVenuePostGame()).toBeFalse();
    expect(fixture.nativeElement.querySelector('.venue-rating-panel')).toBeNull();

    confirmRatingAttendance('player-one');
    component.loadMyVenueRating();
    fixture.detectChanges();
    expect(component.canRateVenuePostGame()).toBeTrue();
    expect(fixture.nativeElement.querySelectorAll('.venue-rating-star').length).toBe(5);
    expect(sessionService.myVenueRating).toHaveBeenCalledWith(7);
  });

  it('submits a venue score separately from the game experience rating', () => {
    (component as any).currentUsername = 'player-one';
    component.session = {
      ...session, joined: true,
      gameDate: new Date(Date.now() - 3 * 3600_000).toISOString(),
      venue: { id: 100, name: 'Recinto Jynlo', city: 'Lisboa' } as any
    };
    confirmRatingAttendance('player-one');
    component.loadMyVenueRating();
    fixture.detectChanges();
    const stars = fixture.nativeElement.querySelectorAll('.venue-rating-star') as NodeListOf<HTMLButtonElement>;
    stars[3].click();
    fixture.detectChanges();
    expect(component.canSaveVenueRating()).toBeTrue();
    (fixture.nativeElement.querySelector('.venue-rating-panel .primary-action') as HTMLButtonElement).click();
    expect(sessionService.rateVenue).toHaveBeenCalledOnceWith(7, 4);
    expect(sessionService.rateOverall).not.toHaveBeenCalled();
    expect(component.myVenueScore).toBe(4);
    expect(component.venueRatingSuccess).toContain('guardada');
  });

  it('never renders venue ratings for a game without a registered venue', () => {
    (component as any).currentUsername = 'player-one';
    component.session = {
      ...session, joined: true,
      gameDate: new Date(Date.now() - 3 * 3600_000).toISOString(),
      venue: null
    };
    confirmRatingAttendance('player-one');
    fixture.detectChanges();
    expect(component.canRateVenuePostGame()).toBeFalse();
    expect(fixture.nativeElement.querySelector('.venue-rating-panel')).toBeNull();
    expect(sessionService.myVenueRating).not.toHaveBeenCalled();
  });

  it('offers one optional overall rating only to registered participants after the game', () => {
    component.session = { ...session, joined: true, gameDate: '2020-10-01T18:00:00Z' };
    confirmRatingAttendance();
    component.loadMyOverallRating();
    fixture.detectChanges();

    expect(component.canRatePostGame()).toBeTrue();
    expect(fixture.nativeElement.querySelector('.overall-rating-panel')).not.toBeNull();
    expect(fixture.nativeElement.querySelectorAll('.overall-rating-star').length).toBe(5);
    expect(fixture.nativeElement.querySelector('.overall-rating-panel').textContent)
      .toContain('Como foi o teu jogo?');
    expect(sessionService.myOverallRating).toHaveBeenCalledWith(7);
    expect(sessionService.rateOverall).not.toHaveBeenCalled();
    expect(reliabilityService.recordAttendance).not.toHaveBeenCalled();
  });

  it('saves a selected star rating and permits editing a stored rating', () => {
    component.session = { ...session, joined: true, gameDate: '2020-10-01T18:00:00Z' };
    confirmRatingAttendance();
    sessionService.myOverallRating.and.returnValue(of({
      overallScore: 3, updatedAt: '2026-10-13T10:00:00Z'
    }));
    component.loadMyOverallRating();
    fixture.detectChanges();

    expect(component.myOverallScore).toBe(3);
    expect(component.selectedOverallScore).toBe(3);
    expect(component.canSaveOverallRating()).toBeFalse();
    expect(component.ratingCollapsedByExisting).toBeTrue();
    expect(fixture.nativeElement.querySelector('.overall-rating-panel')).toBeNull();

    const edit = fixture.nativeElement.querySelector('.rating-reopen-action') as HTMLButtonElement;
    expect(edit.textContent).toContain('Editar avaliação');
    edit.click();
    fixture.detectChanges();
    expect(component.ratingCollapsedByExisting).toBeFalse();

    const stars = fixture.nativeElement.querySelectorAll('.overall-rating-star') as NodeListOf<HTMLButtonElement>;
    stars.item(4).click();
    fixture.detectChanges();
    expect(component.selectedOverallScore).toBe(5);
    (fixture.nativeElement.querySelector('.overall-rating-actions .primary-action') as HTMLButtonElement).click();

    expect(sessionService.rateOverall).toHaveBeenCalledOnceWith(7, 5);
    expect(component.myOverallScore).toBe(5);
    expect(component.ratingSuccess).toContain('atualizada');
    expect(component.canSaveOverallRating()).toBeFalse();
  });

  it('does not keep prompting after a previously saved rating', () => {
    component.session = { ...session, joined: true, gameDate: '2020-10-01T18:00:00Z' };
    confirmRatingAttendance();
    sessionService.myOverallRating.and.returnValue(of({
      overallScore: 4, updatedAt: '2026-10-13T10:00:00Z'
    }));

    component.loadMyOverallRating();
    fixture.detectChanges();
    expect(component.myOverallScore).toBe(4);
    expect(component.ratingCollapsedByExisting).toBeTrue();
    expect(fixture.nativeElement.querySelector('.overall-rating-panel')).toBeNull();
    expect((fixture.nativeElement.querySelector('.rating-reopen-action') as HTMLButtonElement).textContent)
      .toContain('Editar avaliação');
    expect(sessionService.rateOverall).not.toHaveBeenCalled();

    // Refreshing the same joined session doesn't turn the saved rating into a new prompt.
    sessionService.detail.and.returnValue(of({ ...component.session, joined: true }));
    (component as any).loadSession(false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.overall-rating-panel')).toBeNull();
    expect(sessionService.myOverallRating).toHaveBeenCalledTimes(1);
  });

  it('keeps first-time rating success visible on the visit where it was saved', () => {
    component.session = { ...session, joined: true, gameDate: '2020-10-01T18:00:00Z' };
    confirmRatingAttendance();
    component.loadMyOverallRating();
    fixture.detectChanges();
    expect(component.myOverallScore).toBeNull();

    (fixture.nativeElement.querySelectorAll('.overall-rating-star')[4] as HTMLButtonElement).click();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.overall-rating-actions .primary-action') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(component.myOverallScore).toBe(5);
    expect(component.ratingSuccess).toContain('guardada');
    expect(component.ratingCollapsedByExisting).toBeFalse();
    expect(fixture.nativeElement.querySelector('.overall-rating-panel')).not.toBeNull();
    expect(sessionService.rateOverall).toHaveBeenCalledOnceWith(7, 5);
  });

  it('remembers not now for one user and session and allows manual re-opening', () => {
    const dismissedKey = 'jynlo.session-rating-dismissed:rating-dismiss-test-user:7';
    localStorage.removeItem(dismissedKey);
    try {
      (component as any).currentUsername = 'rating-dismiss-test-user';
      component.session = { ...session, joined: true, gameDate: '2020-10-01T18:00:00Z' };
    confirmRatingAttendance();
      component.loadMyOverallRating();
      fixture.detectChanges();

      (fixture.nativeElement.querySelector('.overall-rating-skip') as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(localStorage.getItem(dismissedKey)).toBe('1');
      expect(fixture.nativeElement.querySelector('.overall-rating-panel')).toBeNull();
      expect(fixture.nativeElement.querySelector('.rating-reopen-action')).not.toBeNull();
      expect(sessionService.rateOverall).not.toHaveBeenCalled();

      // Mimic a new visit: the previously saved choice is respected.
      component.ratingDismissed = false;
      (component as any).restoreRatingDismissal();
      expect(component.ratingDismissed).toBeTrue();

      (fixture.nativeElement.querySelector('.rating-reopen-action') as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(localStorage.getItem(dismissedKey)).toBeNull();
      expect(component.ratingDismissed).toBeFalse();
      expect(fixture.nativeElement.querySelector('.overall-rating-panel')).not.toBeNull();
      expect(sessionService.rateOverall).not.toHaveBeenCalled();
    } finally {
      localStorage.removeItem(dismissedKey);
    }
  });

  it('reopens a saved rating after not now was remembered on an earlier visit', () => {
    const key = 'jynlo.session-rating-dismissed:rating-return-test-user:7';
    localStorage.setItem(key, '1');
    try {
      (component as any).currentUsername = 'rating-return-test-user';
      component.session = { ...session, joined: true, gameDate: '2020-10-01T18:00:00Z' };
    confirmRatingAttendance();
      sessionService.myOverallRating.and.returnValue(of({
        overallScore: 4, updatedAt: '2026-10-13T10:00:00Z'
      }));
      (component as any).restoreRatingDismissal();
      fixture.detectChanges();

      expect(component.ratingDismissed).toBeTrue();
      expect(fixture.nativeElement.querySelector('.overall-rating-panel')).toBeNull();
      expect(sessionService.myOverallRating).not.toHaveBeenCalled();

      // The explicit reopen must stay open even when GET finds a prior rating.
      (fixture.nativeElement.querySelector('.rating-reopen-action') as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(sessionService.myOverallRating).toHaveBeenCalledOnceWith(7);
      expect(component.myOverallScore).toBe(4);
      expect(component.selectedOverallScore).toBe(4);
      expect(component.ratingCollapsedByExisting).toBeFalse();
      expect(fixture.nativeElement.querySelector('.overall-rating-panel')).not.toBeNull();
      expect((fixture.nativeElement.querySelector('.overall-rating-actions .primary-action') as HTMLButtonElement).disabled)
        .toBeTrue();
      expect(localStorage.getItem(key)).toBeNull();
      expect(sessionService.rateOverall).not.toHaveBeenCalled();
    } finally {
      localStorage.removeItem(key);
    }
  });

  it('keeps a deliberately reopened editor visible while rating fetch is pending', () => {
    const key = 'jynlo.session-rating-dismissed:rating-pending-test-user:7';
    localStorage.setItem(key, '1');
    try {
      (component as any).currentUsername = 'rating-pending-test-user';
      component.session = { ...session, joined: true, gameDate: '2020-10-01T18:00:00Z' };
    confirmRatingAttendance();
      const pending = new Subject<{ overallScore: number; updatedAt: string } | null>();
      sessionService.myOverallRating.and.returnValue(pending.asObservable());
      (component as any).restoreRatingDismissal();
      fixture.detectChanges();

      (fixture.nativeElement.querySelector('.rating-reopen-action') as HTMLButtonElement).click();
      expect(component.ratingLoading).toBeTrue();
      pending.next({ overallScore: 3, updatedAt: '2026-10-13T10:00:00Z' });
      pending.complete();
      fixture.detectChanges();

      expect(component.ratingLoading).toBeFalse();
      expect(component.myOverallScore).toBe(3);
      expect(component.ratingCollapsedByExisting).toBeFalse();
      expect(fixture.nativeElement.querySelector('.overall-rating-panel')).not.toBeNull();
      expect(sessionService.rateOverall).not.toHaveBeenCalled();
    } finally {
      localStorage.removeItem(key);
    }
  });

  it('keeps dismissals separate for other users and other sessions', () => {
    const firstKey = 'jynlo.session-rating-dismissed:rating-dismiss-test-user:7';
    localStorage.removeItem(firstKey);
    try {
      (component as any).currentUsername = 'rating-dismiss-test-user';
      component.dismissOverallRating();
      expect(localStorage.getItem(firstKey)).toBe('1');

      (component as any).currentUsername = 'another-rating-user';
      (component as any).restoreRatingDismissal();
      expect(component.ratingDismissed).toBeFalse();

      (component as any).currentUsername = 'rating-dismiss-test-user';
      (component as any).sessionId = 8;
      (component as any).restoreRatingDismissal();
      expect(component.ratingDismissed).toBeFalse();
    } finally {
      localStorage.removeItem(firstKey);
    }
  });

  it('can skip the rating without sending it or changing attendance', () => {
    component.session = { ...session, joined: true, gameDate: '2020-10-01T18:00:00Z' };
    confirmRatingAttendance();
    component.loadMyOverallRating();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.overall-rating-skip') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(component.ratingDismissed).toBeTrue();
    expect(fixture.nativeElement.querySelector('.overall-rating-panel')).toBeNull();
    expect(sessionService.rateOverall).not.toHaveBeenCalled();
    expect(reliabilityService.recordAttendance).not.toHaveBeenCalled();
    expect(sessionService.complete).not.toHaveBeenCalled();
  });

  it('never offers ratings to outsiders or for a cancelled or not-occurred game', () => {
    component.session = { ...session, joined: false, gameDate: '2020-10-01T18:00:00Z' };
    expect(component.canRatePostGame()).toBeFalse();
    component.session = { ...session, joined: true, gameDate: new Date().toISOString() };
    expect(component.canRatePostGame()).toBeFalse();
    component.session = { ...session, joined: true, gameDate: '2020-10-01T18:00:00Z', status: 'CANCELLED' };
    expect(component.canRatePostGame()).toBeFalse();
    component.session = { ...session, joined: true, gameDate: '2020-10-01T18:00:00Z', problemType: 'NOT_OCCURRED' };
    expect(component.canRatePostGame()).toBeFalse();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.overall-rating-panel')).toBeNull();
    expect(sessionService.rateOverall).not.toHaveBeenCalled();
  });

  it('does not save an invalid or missing rating', () => {
    component.session = { ...session, joined: true, gameDate: '2020-10-01T18:00:00Z' };
    confirmRatingAttendance();
    component.loadMyOverallRating();
    component.selectedOverallScore = null;
    component.saveOverallRating();
    component.selectOverallScore(0);
    component.selectOverallScore(6);
    component.selectOverallScore(2.5);
    expect(component.selectedOverallScore).toBeNull();
    expect(sessionService.rateOverall).not.toHaveBeenCalled();
  });

  it('can retry retrieving an existing rating without submitting a new one', () => {
    component.session = { ...session, joined: true, gameDate: '2020-10-01T18:00:00Z' };
    confirmRatingAttendance();
    sessionService.myOverallRating.and.returnValue(throwError(() => new Error('offline')));
    component.loadMyOverallRating();
    fixture.detectChanges();

    expect(component.ratingError).toContain('Não foi possível carregar');
    expect(fixture.nativeElement.querySelector('.overall-rating-retry')).not.toBeNull();
    sessionService.myOverallRating.and.returnValue(of(null));
    (fixture.nativeElement.querySelector('.overall-rating-retry') as HTMLButtonElement).click();
    expect(component.ratingError).toBe('');
    expect(sessionService.myOverallRating).toHaveBeenCalledTimes(2);
    expect(sessionService.rateOverall).not.toHaveBeenCalled();
  });

  it('hides star ratings while attendance is pending or marked no-show', () => {
    component.session = { ...session, joined: true, gameDate: '2020-10-01T18:00:00Z' };
    (component as any).currentUsername = 'player-one';
    component.sessionParticipants = [{
      id: 15, username: 'player-one', attendanceStatus: 'PENDING',
      joinedAt: '2026-09-20T18:00:00Z'
    }];
    component.loadMyOverallRating();
    fixture.detectChanges();
    expect(component.canRatePostGame()).toBeFalse();
    expect(fixture.nativeElement.querySelector('.overall-rating-panel')).toBeNull();
    expect(sessionService.myOverallRating).not.toHaveBeenCalled();

    component.sessionParticipants[0].attendanceStatus = 'NO_SHOW';
    expect(component.canRatePostGame()).toBeFalse();

    component.sessionParticipants[0].attendanceStatus = 'LATE_CANCELLED';
    expect(component.canRatePostGame()).toBeFalse();

    component.sessionParticipants[0].attendanceStatus = 'ATTENDED';
    expect(component.canRatePostGame()).toBeTrue();
  });

  it('loads an attendee rating only after the participation roster confirms presence', () => {
    component.session = { ...session, joined: true, gameDate: '2020-10-01T18:00:00Z' };
    (component as any).currentUsername = 'player-one';
    sessionService.participants.and.returnValue(of([{
      id: 15, username: 'player-one', attendanceStatus: 'ATTENDED',
      joinedAt: '2026-09-20T18:00:00Z'
    }]));
    expect(sessionService.myOverallRating).not.toHaveBeenCalled();

    component.loadSessionParticipants();
    fixture.detectChanges();

    expect(component.canRatePostGame()).toBeTrue();
    expect(sessionService.myOverallRating).toHaveBeenCalledOnceWith(7);
    expect(fixture.nativeElement.querySelector('.overall-rating-panel')).not.toBeNull();
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

  it('saves authorised GPS-only venue coordinates in all calendar providers', () => {
    component.session = {
      ...session, canSeeExactAddress: true, address: null,
      venue: { id: 447, name: 'Pavilhão Marítimo', city: 'Aveiro',
        address: '', latitude: 40.6668823, longitude: -8.7391574,
        locationStatus: 'GPS_ONLY_ADDRESS_UNKNOWN' } as any
    };
    expect(new URL(component.googleCalendarUrl()!).searchParams.get('location'))
      .toBe('40.6668823,-8.7391574');
    expect(new URL(component.outlookCalendarUrl()!).searchParams.get('location'))
      .toBe('40.6668823,-8.7391574');
    expect(component.calendarIcsContent()).toContain(
      'LOCATION:40.6668823\\,-8.7391574');
  });

  it('never exports venue coordinates or a private address to the calendar when locked', () => {
    component.session = {
      ...session, canSeeExactAddress: false,
      address: 'Rua Secreta, 21',
      venue: { id: 447, name: 'Recinto Privado', city: 'Lisboa',
        latitude: 38.7223, longitude: -9.1393 } as any
    };
    expect(new URL(component.googleCalendarUrl()!).searchParams.get('location')).toBe('Lisboa');
    expect(new URL(component.outlookCalendarUrl()!).searchParams.get('location')).toBe('Lisboa');
    expect(component.calendarIcsContent()).toContain('LOCATION:Lisboa');
    expect(component.calendarIcsContent()).not.toContain('Rua Secreta');
    expect(component.calendarIcsContent()).not.toContain('38.7223');
  });

  it('does not export a legacy GPS placeholder as a postal address', () => {
    component.session = {
      ...session, canSeeExactAddress: true,
      address: 'Coordenadas (morada por confirmar)',
      venue: { id: 447, latitude: 40.6668823, longitude: -8.7391574 } as any
    };
    expect(new URL(component.googleCalendarUrl()!).searchParams.get('location'))
      .toBe('40.6668823,-8.7391574');
    expect(component.calendarIcsContent()).not.toContain('morada por confirmar');
  });

  it('falls back to municipality for implausible GPS without a usable street address', () => {
    component.session = {
      ...session, canSeeExactAddress: true, address: null,
      venue: { id: 447, latitude: 0, longitude: 0 } as any
    };
    expect(new URL(component.googleCalendarUrl()!).searchParams.get('location')).toBe('Lisboa');
    expect(component.calendarIcsContent()).toContain('LOCATION:Lisboa');
  });

  it('links a registered venue only after the session authorises exact location', () => {
    component.session = {
      ...session, canSeeExactAddress: true,
      venue: { id: 447, name: 'Pavilhão Central', city: 'Lisboa' } as any
    };
    fixture.detectChanges();
    const venueLink = fixture.nativeElement.querySelector('.session-venue-link') as HTMLAnchorElement;
    const detailsAction = fixture.nativeElement.querySelector('.session-venue-details-action') as HTMLAnchorElement;
    expect(venueLink).not.toBeNull();
    expect(detailsAction).not.toBeNull();
    expect(venueLink.getAttribute('href')).toBe('/menu/venues/447');
    expect(detailsAction.getAttribute('href')).toBe('/menu/venues/447');
    expect(detailsAction.textContent).toContain('Ver recinto');

    component.session = { ...session, canSeeExactAddress: false,
      venue: { id: 447, name: 'Pavilhão Central', city: 'Lisboa' } as any };
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.session-venue-link')).toBeNull();
    expect(fixture.nativeElement.querySelector('.session-venue-details-action')).toBeNull();
    expect(fixture.nativeElement.querySelector('.venue-detail-panel h2').textContent)
      .toContain('Pavilhão Central');
  });

  it('scrolls to the participant list without navigating away from the session', () => {
    component.session = {
      ...session,
      joined: true,
      gameDate: new Date(Date.now() + 3600_000).toISOString()
    };
    fixture.detectChanges();

    const banner = fixture.nativeElement.querySelector('.membership-status') as HTMLElement;
    const participantSection = fixture.nativeElement.querySelector('#session-participants') as HTMLElement;
    const button = banner.querySelector('.participants-shortcut') as HTMLButtonElement;
    const scroll = spyOn(participantSection, 'scrollIntoView');
    const urlBefore = window.location.href;

    expect(banner.textContent).toContain('Já estás dentro');
    expect(button.type).toBe('button');
    expect(banner.querySelector('a[href="#session-participants"]')).toBeNull();

    button.click();

    expect(scroll).toHaveBeenCalledOnceWith({ behavior: 'smooth', block: 'start' });
    expect(window.location.href).toBe(urlBefore);
  });

  it('does not show participant navigation to someone who has not joined', () => {
    component.session = { ...session, joined: false };
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.participants-shortcut')).toBeNull();
    component.scrollToParticipants();
    expect(fixture.nativeElement.querySelector('#session-participants')).toBeNull();
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

  it('offers opt-in sharing after the creator makes a public game', async () => {
    const route = TestBed.inject(ActivatedRoute);
    spyOn(route.snapshot.queryParamMap, 'get').and.callFake(key => key === 'created' ? '1' : null);
    (component as any).currentUsername = 'creator-user';
    component.session = { ...session, gameDate: '2099-10-01T18:00:00Z', canSharePublicly: true };
    fixture.detectChanges();
    const panel = fixture.nativeElement.querySelector('.session-created-share') as HTMLElement;
    expect(panel).not.toBeNull();
    const whatsapp = panel.querySelector('a[href^="https://wa.me/"]') as HTMLAnchorElement;
    expect(decodeURIComponent(whatsapp.href)).toContain('/sessions/7');
    const feedLink = panel.querySelector('a[href^="/menu/feed"]') as HTMLAnchorElement;
    expect(feedLink.getAttribute('href')).toContain('shareSession=7');
    const copy = spyOn<any>(component, 'copyShareUrl').and.returnValue(Promise.resolve());
    await component.copyPublicShareLink();
    expect(copy).toHaveBeenCalledWith(new URL('/sessions/7', window.location.origin).href);
    panel.querySelectorAll('button')[1].click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.session-created-share')).toBeNull();
  });

  it('never promotes private, community-only or other peoples games', () => {
    const route = TestBed.inject(ActivatedRoute);
    spyOn(route.snapshot.queryParamMap, 'get').and.returnValue('1');
    (component as any).currentUsername = 'creator-user';
    for (const detail of [
      { privateGame: true, canSharePublicly: false },
      { audience: 'COMMUNITY_ONLY' as const, canSharePublicly: false },
      { canSharePublicly: false }
    ]) {
      component.session = { ...session, gameDate: '2099-10-01T18:00:00Z', ...detail };
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.session-created-share')).toBeNull();
    }
    (component as any).currentUsername = 'someone-else';
    component.session = { ...session, gameDate: '2099-10-01T18:00:00Z', canSharePublicly: true };
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.session-created-share')).toBeNull();
  });

  it('lets the organizer reopen WhatsApp, link and Feed options on a later visit', async () => {
    (component as any).currentUsername = 'creator-user';
    component.session = { ...session, gameDate: '2099-10-01T18:00:00Z', canSharePublicly: true };
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.session-created-share')).toBeNull();
    const toggle = fixture.nativeElement.querySelector('.open-promotion-button') as HTMLButtonElement;
    expect(toggle).not.toBeNull();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    toggle.click();
    fixture.detectChanges();

    const panel = fixture.nativeElement.querySelector('.session-created-share') as HTMLElement;
    expect(panel.textContent).toContain('Divulgar jogo');
    expect(panel.querySelector('a[href^="https://wa.me/"]')).not.toBeNull();
    expect((panel.querySelector('a[href^="/menu/feed"]') as HTMLAnchorElement)
      .getAttribute('href')).toContain('shareSession=7');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    const copy = spyOn<any>(component, 'copyShareUrl').and.returnValue(Promise.reject(new Error('Denied')));
    await component.copyPublicShareLink();
    fixture.detectChanges();
    expect(copy).toHaveBeenCalled();
    expect((panel.querySelector('#session-share-url') as HTMLInputElement).value)
      .toBe(new URL('/sessions/7', window.location.origin).href);
    toggle.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.session-created-share')).toBeNull();
  });

  it('opens sharing from My Sports Week only when the viewer owns a public game', () => {
    const route = TestBed.inject(ActivatedRoute);
    spyOn(route.snapshot.queryParamMap, 'get')
      .and.callFake(key => key === 'promote' ? '1' : null);
    component.ngOnInit();
    (component as any).currentUsername = 'creator-user';
    component.session = {
      ...session, canSharePublicly: true, gameDate: '2099-10-01T18:00:00Z'
    };
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.session-created-share')).not.toBeNull();

    component.session = { ...component.session, privateGame: true, canSharePublicly: false };
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.session-created-share')).toBeNull();

    component.session = {
      ...session, canSharePublicly: true, gameDate: '2099-10-01T18:00:00Z'
    };
    (component as any).currentUsername = 'different-user';
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.session-created-share')).toBeNull();
  });

  it('never offers re-promotion for private, community-only, past, or other users games', () => {
    (component as any).currentUsername = 'creator-user';
    for (const detail of [
      { privateGame: true, canSharePublicly: false },
      { audience: 'COMMUNITY_ONLY' as const, canSharePublicly: false },
      { status: 'CANCELLED' as const, canSharePublicly: true },
      { gameDate: '2020-10-01T18:00:00Z', canSharePublicly: true }
    ]) {
      component.session = {
        ...session, gameDate: '2099-10-01T18:00:00Z', ...detail
      };
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.open-promotion-button')).toBeNull();
    }
    (component as any).currentUsername = 'someone-else';
    component.session = { ...session, gameDate: '2099-10-01T18:00:00Z', canSharePublicly: true };
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.open-promotion-button')).toBeNull();
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

  it('shows the organiser confirmed players and remaining slots before a future game', () => {
    (component as any).currentUsername = 'creator-user';
    component.session = {
      ...session, joined: true, status: 'OPEN',
      gameDate: new Date(Date.now() + 86_400_000).toISOString()
    };
    fixture.detectChanges();

    const panel = fixture.nativeElement.querySelector('.organizer-preparation') as HTMLElement;
    expect(panel).not.toBeNull();
    expect(panel.textContent).toContain('Preparação do jogo');
    expect(panel.textContent).toContain('2/4');
    expect(panel.textContent).toContain('Faltam 2 jogadores');
    expect(panel.querySelectorAll('button').length).toBe(2);
    expect(fixture.nativeElement.querySelector('#session-player-search')).not.toBeNull();

    const scroll = spyOn(fixture.nativeElement.querySelector('#session-player-search'), 'scrollIntoView');
    const findButton = Array.from(panel.querySelectorAll('button'))
      .find((button: any) => button.textContent.includes('Encontrar jogadores')) as HTMLButtonElement;
    findButton.click();
    expect(scroll).toHaveBeenCalledOnceWith({ behavior: 'smooth', block: 'start' });
    expect(sessionService.join).not.toHaveBeenCalled();
  });

  it('respects a FULL backend status even if its count has not refreshed', () => {
    (component as any).currentUsername = 'creator-user';
    component.session = {
      ...session, status: 'FULL', participantCount: 3, maxParticipants: 4,
      gameDate: new Date(Date.now() + 86_400_000).toISOString()
    };
    fixture.detectChanges();

    const panel = fixture.nativeElement.querySelector('.organizer-preparation') as HTMLElement;
    expect(panel.textContent).toContain('3/4');
    expect(panel.textContent).toContain('marcada como cheia');
    expect(panel.textContent).not.toContain('Faltam 1 jogadores');
    // A full game must not invite more players, but its creator can inspect the roster.
    expect(panel.querySelector('button')?.textContent).toContain('Quem vai');
    expect(panel.textContent).not.toContain('Encontrar jogadores');
    expect(component.canFindPlayers()).toBeFalse();
    expect(fixture.nativeElement.querySelector('#session-player-search')).toBeNull();
  });

  it('does not expose public player-search actions for private or community-only sessions', () => {
    (component as any).currentUsername = 'creator-user';
    const future = new Date(Date.now() + 86_400_000).toISOString();
    for (const partial of [
      { privateGame: true },
      { audience: 'COMMUNITY_ONLY' as const }
    ]) {
      component.session = { ...session, gameDate: future, ...partial };
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.organizer-preparation')).not.toBeNull();
      expect(component.canFindPlayers()).toBeFalse();
      expect(fixture.nativeElement.querySelector('#session-player-search')).toBeNull();
    }
  });

  it('does not invent organiser readiness for another user or invalid and ended games', () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    (component as any).currentUsername = 'other-user';
    component.session = { ...session, gameDate: future };
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.organizer-preparation')).toBeNull();

    (component as any).currentUsername = 'creator-user';
    for (const state of [
      { status: 'CANCELLED' },
      { status: 'COMPLETED' },
      { gameDate: new Date(Date.now() - 60000).toISOString() },
      { gameDate: 'invalid' },
      { participantCount: Number.NaN },
      { participantCount: -1 },
      { participantCount: 5 },
      { maxParticipants: 0 },
      { maxParticipants: Number.NaN }
    ]) {
      component.session = { ...session, gameDate: future, ...state };
      expect(component.organizerPreparation()).withContext(JSON.stringify(state)).toBeNull();
      expect(component.canFindPlayers()).withContext(JSON.stringify(state)).toBeFalse();
    }
    component.session = { ...session, gameDate: future, participantCount: 4 };
    expect(component.organizerPreparation()?.full).toBeTrue();
    expect(component.canFindPlayers()).toBeFalse();
  });

  it('offers a filtered player search to the creator of a future public session with vacancies', () => {
    (component as any).currentUsername = 'creator-user';
    component.session = { ...session, gameDate: '2099-10-01T18:00:00Z' };
    fixture.detectChanges();

    expect(component.missingPlayers()).toBe(2);
    expect(component.canFindPlayers()).toBeTrue();
    const action = fixture.nativeElement.querySelector('.session-player-search a') as HTMLAnchorElement;
    expect(action.textContent).toContain('Procurar jogadores');
    expect(action.getAttribute('href')).toBe('/menu/perfis?from=people&sport=Padel&city=Lisboa');
  });

  it('does not suggest finding players for private, full, past or other peoples sessions', () => {
    (component as any).currentUsername = 'creator-user';
    const future = '2099-10-01T18:00:00Z';
    component.session = { ...session, gameDate: future, privateGame: true };
    expect(component.canFindPlayers()).toBeFalse();
    component.session = { ...session, gameDate: future, participantCount: 4 };
    expect(component.canFindPlayers()).toBeFalse();
    component.session = { ...session, gameDate: '2020-10-01T18:00:00Z' };
    expect(component.canFindPlayers()).toBeFalse();
    component.session = { ...session, gameDate: future };
    (component as any).currentUsername = 'other-user';
    expect(component.canFindPlayers()).toBeFalse();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.session-player-search')).toBeNull();
  });

  it('offers post-game sharing to a participant of a completed public session', () => {
    component.session = {
      ...session, status: 'COMPLETED', joined: true, canSharePublicly: true
    };
    fixture.detectChanges();

    expect(component.canSharePostGameMoment()).toBeTrue();
    const link = fixture.nativeElement.querySelector('.postgame-action') as HTMLAnchorElement;
    expect(link).not.toBeNull();
    expect(link.getAttribute('href')).toContain('/menu/feed?momentSession=7');
    expect(link.textContent).toContain('Partilhar momento');
  });

  it('translates the post-game sharing action in English and Portuguese', () => {
    const i18n = TestBed.inject(I18nService);
    component.session = {
      ...session, status: 'COMPLETED', joined: true, canSharePublicly: true
    };

    try {
      i18n.setLanguage('en');
      fixture.detectChanges();
      const link = fixture.nativeElement.querySelector('.postgame-action') as HTMLAnchorElement;
      expect(link.textContent.trim()).toBe('Share a game moment');

      i18n.setLanguage('pt');
      fixture.detectChanges();
      expect(link.textContent.trim()).toBe('Partilhar momento');
    } finally {
      i18n.setLanguage('pt');
    }
  });

  it('does not offer post-game sharing for unrelated, private or unfinished sessions', () => {
    const cases = [
      { status: 'OPEN', joined: true, canSharePublicly: true },
      { status: 'CANCELLED', joined: true, canSharePublicly: true },
      { status: 'COMPLETED', joined: false, canSharePublicly: true },
      { status: 'COMPLETED', joined: true, canSharePublicly: false },
      { status: 'COMPLETED', joined: true, canSharePublicly: undefined }
    ];
    for (const scenario of cases) {
      component.session = { ...session, ...scenario };
      fixture.detectChanges();
      expect(component.canSharePostGameMoment()).withContext(JSON.stringify(scenario)).toBeFalse();
      expect(fixture.nativeElement.querySelector('.postgame-action')).toBeNull();
    }
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

  it('scrolls to the join action without navigating away from the session', () => {
    component.session = {
      ...session,
      gameDate: new Date(Date.now() + 3600_000).toISOString()
    };
    fixture.detectChanges();

    const shortcut = fixture.nativeElement.querySelector('.join-shortcut') as HTMLButtonElement;
    const participation = fixture.nativeElement.querySelector('#session-participation') as HTMLElement;
    const scroll = spyOn(participation, 'scrollIntoView');
    const urlBefore = window.location.href;

    expect(shortcut).not.toBeNull();
    expect(shortcut.type).toBe('button');
    expect(shortcut.getAttribute('href')).toBeNull();
    expect(shortcut.textContent).toContain('Ver inscrição');
    expect(participation.querySelector('.join-controls .primary-action')).not.toBeNull();

    shortcut.click();

    expect(scroll).toHaveBeenCalledOnceWith({ behavior: 'smooth', block: 'start' });
    expect(window.location.href).toBe(urlBefore);
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

    const shortcut = fixture.nativeElement.querySelector('.join-shortcut') as HTMLButtonElement;
    const participation = fixture.nativeElement.querySelector('#session-participation') as HTMLElement;
    const scroll = spyOn(participation, 'scrollIntoView');
    const urlBefore = window.location.href;
    expect(shortcut.textContent).toContain('lista de espera');

    shortcut.click();

    expect(scroll).toHaveBeenCalledOnceWith({ behavior: 'smooth', block: 'start' });
    expect(window.location.href).toBe(urlBefore);
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

  it('scrolls to participation after loading a future session from Discover', () => {
    fixture.destroy();
    const route = TestBed.inject(ActivatedRoute);
    (route.snapshot as any).queryParamMap = convertToParamMap({ join: '1' });
    const futureSession = {
      ...session, gameDate: new Date(Date.now() + 3600_000).toISOString()
    };
    const delayedDetail = new Subject<typeof futureSession>();
    sessionService.detail.and.returnValue(delayedDetail.asObservable());
    const scroll = jasmine.createSpy('scrollIntoView');
    const originalGetById = document.getElementById.bind(document);
    spyOn(document, 'getElementById').and.callFake((id: string) => {
      if (id === 'session-participation') {
        return { scrollIntoView: scroll } as unknown as HTMLElement;
      }
      return originalGetById(id);
    });

    const page = TestBed.createComponent(SessionDetailsComponent);
    page.detectChanges();
    expect(scroll).not.toHaveBeenCalled();

    delayedDetail.next(futureSession);
    delayedDetail.complete();
    page.detectChanges();

    expect(scroll).toHaveBeenCalledOnceWith({ behavior: 'smooth', block: 'start' });
    expect(sessionService.join).not.toHaveBeenCalled();
    page.detectChanges();
    expect(scroll).toHaveBeenCalledTimes(1);
    page.destroy();
  });

  it('focuses current membership once after a promoted waitlist notification loads', () => {
    fixture.destroy();
    const route = TestBed.inject(ActivatedRoute);
    (route.snapshot as any).queryParamMap = convertToParamMap({ membership: '1' });
    const promoted = {
      ...session, joined: true, waitlisted: false,
      gameDate: new Date(Date.now() + 3600_000).toISOString()
    };
    const delayedDetail = new Subject<typeof promoted>();
    sessionService.detail.and.returnValue(delayedDetail.asObservable());

    const scroll = jasmine.createSpy('scrollIntoView');
    const originalGetById = document.getElementById.bind(document);
    spyOn(document, 'getElementById').and.callFake((id: string) => {
      if (id === 'session-membership') {
        return { scrollIntoView: scroll } as unknown as HTMLElement;
      }
      return originalGetById(id);
    });

    const page = TestBed.createComponent(SessionDetailsComponent);
    page.detectChanges();
    expect(scroll).not.toHaveBeenCalled();
    delayedDetail.next(promoted);
    delayedDetail.complete();
    page.detectChanges();

    expect(page.nativeElement.querySelector('#session-membership')).not.toBeNull();
    expect(scroll).toHaveBeenCalledOnceWith({ behavior: 'smooth', block: 'start' });
    expect(sessionService.join).not.toHaveBeenCalled();
    page.detectChanges();
    expect(scroll).toHaveBeenCalledTimes(1);
    page.destroy();
  });

  it('shows the current waitlist position when a historical promotion no longer applies', () => {
    fixture.destroy();
    const route = TestBed.inject(ActivatedRoute);
    (route.snapshot as any).queryParamMap = convertToParamMap({ membership: '1' });
    sessionService.detail.and.returnValue(of({
      ...session, joined: false, waitlisted: true, waitlistPosition: 2,
      gameDate: new Date(Date.now() + 3600_000).toISOString()
    }));
    const scroll = jasmine.createSpy('scrollIntoView');
    const originalGetById = document.getElementById.bind(document);
    spyOn(document, 'getElementById').and.callFake((id: string) => {
      if (id === 'session-membership') {
        return { scrollIntoView: scroll } as unknown as HTMLElement;
      }
      return originalGetById(id);
    });

    const page = TestBed.createComponent(SessionDetailsComponent);
    page.detectChanges();

    const status = page.nativeElement.querySelector('#session-membership') as HTMLElement;
    expect(status.classList.contains('waitlisted')).toBeTrue();
    expect(status.textContent).toContain('na posição 2');
    expect(scroll).toHaveBeenCalledOnceWith({ behavior: 'smooth', block: 'start' });
    expect(sessionService.join).not.toHaveBeenCalled();
    page.destroy();
  });

  it('does not show a stale promotion as confirmed membership after leaving', () => {
    fixture.destroy();
    const route = TestBed.inject(ActivatedRoute);
    (route.snapshot as any).queryParamMap = convertToParamMap({ membership: '1' });
    sessionService.detail.and.returnValue(of({
      ...session, joined: false, waitlisted: false,
      gameDate: new Date(Date.now() + 3600_000).toISOString()
    }));
    const scroll = jasmine.createSpy('scrollIntoView');
    const originalGetById = document.getElementById.bind(document);
    spyOn(document, 'getElementById').and.callFake((id: string) => {
      if (id === 'session-membership') {
        return { scrollIntoView: scroll } as unknown as HTMLElement;
      }
      return originalGetById(id);
    });

    const page = TestBed.createComponent(SessionDetailsComponent);
    page.detectChanges();
    expect(page.nativeElement.querySelector('#session-membership')).toBeNull();
    expect(scroll).not.toHaveBeenCalled();
    expect(sessionService.join).not.toHaveBeenCalled();
    page.destroy();
  });

  it('does not scroll to joining when the Discover visitor is already participating', () => {
    fixture.destroy();
    const route = TestBed.inject(ActivatedRoute);
    (route.snapshot as any).queryParamMap = convertToParamMap({ join: '1' });
    sessionService.detail.and.returnValue(of({
      ...session, joined: true, gameDate: new Date(Date.now() + 3600_000).toISOString()
    }));
    const scroll = jasmine.createSpy('scrollIntoView');
    const originalGetById = document.getElementById.bind(document);
    spyOn(document, 'getElementById').and.callFake((id: string) => {
      if (id === 'session-participation') {
        return { scrollIntoView: scroll } as unknown as HTMLElement;
      }
      return originalGetById(id);
    });

    const page = TestBed.createComponent(SessionDetailsComponent);
    page.detectChanges();

    expect(scroll).not.toHaveBeenCalled();
    expect(sessionService.join).not.toHaveBeenCalled();
    page.destroy();
  });

  it('rejects non-integer session IDs without requesting details', () => {
    fixture.destroy();
    const route = TestBed.inject(ActivatedRoute);
    (route.snapshot as any).paramMap = convertToParamMap({ id: '7.5' });
    sessionService.detail.calls.reset();

    const page = TestBed.createComponent(SessionDetailsComponent);
    page.detectChanges();

    expect(page.componentInstance.errorMessage).toBeTruthy();
    expect(sessionService.detail).not.toHaveBeenCalled();
    page.destroy();
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

  it('does not offer leaving a completed or cancelled session', () => {
    for (const status of ['COMPLETED', 'CANCELLED']) {
      for (const membership of [{ joined: true }, { waitlisted: true }]) {
        component.session = { ...session, ...membership, status };
        fixture.detectChanges();

        expect(component.canLeaveSession()).toBeFalse();
        expect(fixture.nativeElement.querySelector('.participation-panel button.danger-action')).toBeNull();

        component.leaveSession();
      }
    }

    expect(sessionService.leave).not.toHaveBeenCalled();
  });

  it('does not offer leaving after the session starts', () => {
    component.session = {
      ...session,
      joined: true,
      status: 'OPEN',
      gameDate: new Date(Date.now() - 3600_000).toISOString()
    };
    fixture.detectChanges();

    expect(component.canLeaveSession()).toBeFalse();
    expect(fixture.nativeElement.querySelector('.participation-panel button.danger-action')).toBeNull();

    component.leaveSession();
    expect(sessionService.leave).not.toHaveBeenCalled();
  });

  it('does not offer leaving a waitlist after the session starts', () => {
    component.session = {
      ...session,
      joined: false,
      waitlisted: true,
      status: 'FULL',
      gameDate: new Date(Date.now() - 3600_000).toISOString()
    };
    fixture.detectChanges();

    expect(component.canLeaveSession()).toBeFalse();
    component.leaveSession();
    expect(sessionService.leave).not.toHaveBeenCalled();
  });

  it('allows an active participant to leave an open session', () => {
    component.session = {
      ...session,
      joined: true,
      gameDate: new Date(Date.now() + 3600_000).toISOString()
    };
    fixture.detectChanges();

    expect(component.canLeaveSession()).toBeTrue();
    expect(fixture.nativeElement.querySelector('.participation-panel button.danger-action')).not.toBeNull();

    component.leaveSession();

    expect(sessionService.leave).toHaveBeenCalledOnceWith(7);
  });

  it('should leave a waitlisted session and refresh details', () => {
    component.session = {
      ...session,
      waitlisted: true,
      waitlistPosition: 2,
      gameDate: new Date(Date.now() + 3600_000).toISOString()
    };

    component.leaveSession();

    expect(sessionService.leave).toHaveBeenCalledWith(7);
    expect(sessionService.detail).toHaveBeenCalledTimes(2);
    expect(component.actionSuccess).toContain('lista de espera');
  });

  it('should report a selected problem for a started session without reloading details', () => {
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
    expect(sessionService.detail).toHaveBeenCalledTimes(1);
    expect(component.actionSuccess).toBeTruthy();
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

  it('keeps past-session chat unavailable on details without deleting server messages', () => {
    const archived: SessionMessage = {
      id: 7,
      sessionId: 7,
      senderUsername: 'player-one',
      body: 'Até ao próximo jogo!',
      createdAt: '2026-10-01T18:00:00Z'
    };
    component.session = { ...session, joined: true };
    sessionService.messages.and.returnValue(of([archived]));

    component.refreshMessages();
    fixture.detectChanges();

    expect(component.canAccessChat()).toBeTrue();
    expect(component.canSendChat()).toBeFalse();
    expect(fixture.nativeElement.querySelector('.chat-panel')).toBeNull();
    expect(fixture.nativeElement.querySelector('.message-composer')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Chat indisponível');
    expect(component.messages.some(item => item.body === 'Até ao próximo jogo!')).toBeTrue();

    component.messageBody = 'Tentar enviar depois do jogo';
    component.sendMessage();
    expect(sessionService.postMessage).not.toHaveBeenCalled();
  });

  it('closes chat as soon as the game starts', () => {
    component.session = {
      ...session,
      joined: true,
      gameDate: new Date(Date.now() - 60 * 60_000).toISOString()
    };
    fixture.detectChanges();

    expect(component.canSendChat()).toBeFalse();
    expect(fixture.nativeElement.querySelector('.message-composer')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Chat indisponível');
  });

  it('immediately closes chat when the game is completed, cancelled or did not occur', () => {
    component.session = {
      ...session,
      joined: true,
      gameDate: new Date(Date.now() + 4 * 60 * 60_000).toISOString()
    };
    expect(component.canSendChat()).toBeTrue();

    component.session = { ...component.session, status: 'COMPLETED' };
    expect(component.canSendChat()).toBeFalse();

    component.session = { ...component.session, status: 'CANCELLED' };
    expect(component.canSendChat()).toBeFalse();

    component.session = { ...component.session, status: 'OPEN', problemType: 'NOT_OCCURRED' };
    expect(component.canSendChat()).toBeFalse();
  });

  it('does not render another chat UI for a concluded session', () => {
    component.session = { ...session, joined: true };
    component.messages = [];
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.empty-chat')).toBeNull();
    expect(fixture.nativeElement.querySelector('.message-composer')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Chat indisponível');
  });

  it('should send a chat message and append it locally', () => {
    component.session = {
      ...session,
      joined: true,
      gameDate: new Date(Date.now() + 4 * 60 * 60_000).toISOString()
    };
    component.messageBody = '  Bora jogar!  ';

    component.sendMessage();

    expect(sessionService.postMessage).toHaveBeenCalledWith(7, 'Bora jogar!');
    expect(component.messages.length).toBe(1);
    expect(component.messageBody).toBe('');
  });

  it('sends a quoted session reply with the parent ID and renders persisted snapshot', () => {
    component.session = { ...session, joined: true,
      gameDate: new Date(Date.now() + 3_600_000).toISOString() };
    const original: SessionMessage = { id: 30, sessionId: 7, senderUsername: 'player-two',
      body: 'Levas as bolas?', createdAt: new Date().toISOString() };
    component.messages = [original];
    component.replyToSessionMessage(original);
    expect(component.replyingToSessionMessage?.id).toBe(30);
    const response: SessionMessage = { id: 31, sessionId: 7, senderUsername: 'player-one',
      body: 'Levo!', createdAt: new Date().toISOString(),
      replyToMessageId: 30, replyToSender: 'player-two', replyToText: 'Levas as bolas?' };
    sessionService.postMessage.and.returnValue(of(response));
    component.messageBody = 'Levo!';
    component.sendMessage();
    expect(sessionService.postMessage).toHaveBeenCalledOnceWith(7, 'Levo!', 30);
    expect(component.replyingToSessionMessage).toBeNull();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.chat-panel')).toBeNull();
    expect(component.messages.some(item => item.replyToMessageId === 30)).toBeTrue();
  });

  it('preserves quoted parent and text after an uncertain session POST', () => {
    component.session = { ...session, joined: true,
      gameDate: new Date(Date.now() + 3_600_000).toISOString() };
    const original: SessionMessage = { id: 40, sessionId: 7, senderUsername: 'player-two',
      body: 'A que horas?', createdAt: new Date().toISOString() };
    component.replyToSessionMessage(original);
    component.messageBody = 'Às oito';
    sessionService.postMessage.and.returnValue(throwError(() => new HttpErrorResponse({ status: 0 })));
    sessionService.messages.and.returnValue(of([]));
    component.sendMessage();
    expect(component.replyingToSessionMessage?.id).toBe(40);
    expect(component.messageBody).toBe('Às oito');
    expect(component.chatDeliveryUncertain).toBeTrue();
    component.sendMessage();
    expect(sessionService.postMessage).toHaveBeenCalledTimes(1);
  });

  it('keeps a socket message when an older HTTP chat response arrives afterwards', () => {
    component.session = {
      ...session, joined: true,
      gameDate: new Date(Date.now() + 3_600_000).toISOString()
    };
    const pending = new Subject<SessionMessage[]>();
    sessionService.messages.and.returnValue(pending.asObservable());
    component.refreshMessages();
    const incoming: SessionMessage = {
      id: 801, sessionId: 7, senderUsername: 'player-one',
      body: 'Chego em 5 minutos', createdAt: new Date().toISOString()
    };
    realtimeSessionMessages.next(incoming);
    pending.next([]);
    pending.complete();
    expect(component.messages).toEqual([incoming]);
    realtimeSessionMessages.next(incoming);
    expect(component.messages.length).toBe(1);
  });

  it('shows one inbox chat entry instead of another session chat header', () => {
    component.session = {
      ...session, joined: true,
      gameDate: new Date(Date.now() + 3_600_000).toISOString()
    };
    realtimeConnected.next(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Chat da sessão');
    expect(fixture.nativeElement.querySelector('.chat-panel')).toBeNull();
    realtimeConnected.next(false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.sync-status')).toBeNull();
  });

  it('blocks a second session POST after network loss until delivery is verified', async () => {
    component.session = {
      ...session, joined: true,
      gameDate: new Date(Date.now() + 3_600_000).toISOString()
    };
    (component as any).currentUsername = 'fixture-user';
    component.messageBody = 'Confirmam a hora?';
    sessionService.postMessage.and.returnValue(throwError(() => new HttpErrorResponse({ status: 0 })));
    sessionService.messages.and.returnValue(of([]));
    component.sendMessage();
    expect(component.chatDeliveryUncertain).toBeTrue();
    expect(component.messageBody).toBe('Confirmam a hora?');
    component.sendMessage();
    expect(sessionService.postMessage).toHaveBeenCalledTimes(1);
    fixture.detectChanges();
    await fixture.whenStable(); // ngModel schedules the disabled state asynchronously.
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.chat-delivery-warning')).toBeNull();
    expect(fixture.nativeElement.querySelector('.message-composer')).toBeNull();
    component.resumeChatAfterUncertainSend();
    expect(component.chatDeliveryUncertain).toBeFalse();
    expect(component.messageBody).toBe('Confirmam a hora?');
    expect(sessionService.postMessage).toHaveBeenCalledTimes(1);
  });

  it('confirms uncertain delivery from session chat history without a duplicate POST', () => {
    component.session = {
      ...session, joined: true,
      gameDate: new Date(Date.now() + 3_600_000).toISOString()
    };
    (component as any).currentUsername = 'fixture-user';
    component.messageBody = 'Até logo, equipa';
    const delivered: SessionMessage = {
      id: 810, sessionId: 7, senderUsername: 'fixture-user',
      body: 'Até logo, equipa', createdAt: new Date().toISOString()
    };
    sessionService.postMessage.and.returnValue(throwError(() => new HttpErrorResponse({ status: 503 })));
    sessionService.messages.and.returnValue(of([delivered]));
    component.sendMessage();
    expect(component.chatDeliveryUncertain).toBeFalse();
    expect(component.messageBody).toBe('');
    expect(component.messages.map(message => message.id)).toContain(810);
    expect(sessionService.postMessage).toHaveBeenCalledTimes(1);
  });

  it('never mistakes an older identical message for the uncertain new message', () => {
    component.session = {
      ...session, joined: true,
      gameDate: new Date(Date.now() + 3_600_000).toISOString()
    };
    (component as any).currentUsername = 'fixture-user';
    const old: SessionMessage = {
      id: 707, sessionId: 7, senderUsername: 'fixture-user',
      body: 'Bora jogar', createdAt: new Date().toISOString()
    };
    component.messages = [old];
    component.messageBody = 'Bora jogar';
    sessionService.postMessage.and.returnValue(throwError(() => new HttpErrorResponse({ status: 408 })));
    sessionService.messages.and.returnValue(of([old]));
    component.sendMessage();
    expect(component.chatDeliveryUncertain).toBeTrue();
    expect(component.messageBody).toBe('Bora jogar');
    expect(sessionService.postMessage).toHaveBeenCalledTimes(1);
  });

  it('does not submit Enter during text composition', () => {
    const event = new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, cancelable: true });
    component.onChatEnter(event);
    expect(event.defaultPrevented).toBeFalse();
    expect(sessionService.postMessage).not.toHaveBeenCalled();
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
      joined: true,
      gameDate: new Date(Date.now() + 4 * 60 * 60_000).toISOString()
    };
    component.messageBody = 'Bora jogar!';

    realtimeSessionMessages.next(message);
    component.sendMessage();

    expect(sessionService.postMessage).toHaveBeenCalledWith(7, 'Bora jogar!');
    expect(component.messages).toEqual([message]);
  });

  it('lets the creator see confirmed player profiles without taking a playing spot', () => {
    sessionService.participants.calls.reset();
    sessionService.messages.calls.reset();
    (component as any).currentUsername = 'creator-user';
    sessionService.detail.and.returnValue(of({
      ...session,
      joined: false,
      gameDate: new Date(Date.now() + 86_400_000).toISOString()
    }));

    component.retrySessionLoad();
    fixture.detectChanges();

    expect(sessionService.participants).toHaveBeenCalledWith(7);
    expect(component.sessionParticipants.map(p => p.username)).toEqual(['player-one']);
    expect(component.session?.joined).toBeFalse();
    expect(sessionService.join).not.toHaveBeenCalled();
    expect(sessionService.messages).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('.message-composer')).toBeNull();

    const section = fixture.nativeElement.querySelector('#session-participants') as HTMLElement;
    expect(section).not.toBeNull();
    expect(section.textContent).toContain('@player-one');
    expect(section.textContent).toContain('perfis de jogadores visíveis');
    const summary = fixture.nativeElement.querySelector('.organizer-preparation') as HTMLElement;
    const button = Array.from(summary.querySelectorAll('button'))
      .find((candidate: any) => candidate.textContent.includes('Quem vai')) as HTMLButtonElement;
    expect(button).toBeDefined();
    const scroll = spyOn(section, 'scrollIntoView');
    button.click();
    expect(scroll).toHaveBeenCalledOnceWith({ behavior: 'smooth', block: 'start' });
  });

  it('shows creator roster loading and never equates its size with total confirmed places', () => {
    sessionService.participants.calls.reset();
    (component as any).currentUsername = 'creator-user';
    const pending = new Subject<any[]>();
    sessionService.participants.and.returnValue(pending.asObservable());
    sessionService.detail.and.returnValue(of({
      ...session,
      joined: false,
      participantCount: 4,
      maxParticipants: 5
    }));

    component.retrySessionLoad();
    fixture.detectChanges();
    const section = fixture.nativeElement.querySelector('#session-participants') as HTMLElement;
    expect(section.textContent).toContain('A carregar jogadores confirmados');
    expect(section.textContent).not.toContain('4 perfis');
    pending.next([{
      id: 15, username: 'player-one', attendanceStatus: 'PENDING',
      joinedAt: '2026-09-20T18:00:00Z'
    }]);
    pending.complete();
    fixture.detectChanges();

    expect(sessionService.participants).toHaveBeenCalledTimes(1);
    expect(section.textContent).toContain('1 perfis de jogadores visíveis');
    expect(section.textContent).not.toContain('A carregar jogadores confirmados');
  });

  it('keeps the participant roster inaccessible to non-participants who are not creators', () => {
    sessionService.participants.calls.reset();
    (component as any).currentUsername = 'outsider';
    component.session = {
      ...session,
      joined: false,
      creatorUsername: 'creator-user'
    };
    component.sessionParticipants = [{
      id: 15, username: 'player-one', attendanceStatus: 'PENDING',
      joinedAt: '2026-09-20T18:00:00Z'
    }];

    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('#session-participants')).toBeNull();
    expect(fixture.nativeElement.querySelector('.organizer-preparation')).toBeNull();
    component.loadSessionParticipants();
    component.scrollToParticipants();
    expect(sessionService.participants).not.toHaveBeenCalled();
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

  it('offers the Excel team balancer to a community organiser who does not take a playing slot', () => {
    (component as any).currentUsername = 'creator-user';
    component.session = {
      ...session, creatorUsername: 'creator-user', joined: false, waitlisted: false,
      communityId: 9, sport: 'Futebol', teamBalanceSupported: true, participantCount: 10, maxParticipants: 10,
      status: 'FULL', gameDate: new Date(Date.now() + 86_400_000).toISOString()
    };
    fixture.detectChanges();
    const panel: HTMLElement = fixture.nativeElement.querySelector('.team-generator');
    expect(panel).toBeTruthy();
    const excel: HTMLButtonElement | null = panel.querySelector('.team-generator-excel-action');
    expect(excel).toBeTruthy();
    excel!.click();
    expect(sessionService.teamSuggestion).toHaveBeenCalledWith(7, 'EXCEL_POINTS');
    expect(component.teamSuggestionPendingConfirmation).toBeTrue();
  });

  it('does not offer Excel team generation to non-organisers or before the roster is full', () => {
    component.session = {
      ...session, communityId: 9, sport: 'Futebol', teamBalanceSupported: true, participantCount: 10, maxParticipants: 10,
      status: 'FULL', gameDate: new Date(Date.now() + 86_400_000).toISOString()
    };
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.team-generator-excel-action')).toBeNull();
    (component as any).currentUsername = 'creator-user';
    component.session = { ...component.session, participantCount: 9, status: 'OPEN' };
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.team-generator-excel-action')).toBeNull();
  });

  it('should generate balanced teams for a full community session created by the viewer', () => {
    (component as any).currentUsername = 'creator-user';
    component.session = {
      ...session,
      creatorUsername: 'creator-user',
      joined: true,
      communityId: 9, sport: 'Futebol', teamBalanceSupported: true,
      participantCount: 4,
      maxParticipants: 4,
      status: 'FULL'
    };

    expect(component.canGenerateTeams()).toBeTrue();

    component.generateTeams();

    expect(sessionService.teamSuggestion).toHaveBeenCalledWith(7, 'FORM');
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
      communityId: 9, sport: 'Futebol', teamBalanceSupported: true,
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

    expect(sessionService.confirmTeams).toHaveBeenCalledWith(7, 'FORM');
    expect(component.teamsSuccess).toContain('confirmadas');
    expect(component.teamSuggestionPendingConfirmation).toBeFalse();
    expect(component.hasConfirmedTeams()).toBeTrue();
    expect(component.teamParticipants('A')[0].username).toBe('creator-user');
  });

  it('offers Excel balancing as a separate, non-persisting organiser preview', () => {
    (component as any).currentUsername = 'creator-user';
    component.session = {
      ...session, joined: true, creatorUsername: 'creator-user',
      communityId: 9, sport: 'Futebol', teamBalanceSupported: true, participantCount: 10, maxParticipants: 10, status: 'FULL'
    };
    const preview = {
      teamA: [{ username: 'creator-user', strengthScore: 20, statsAvailable: true,
        games: 0, wins: 0, goals: 0, assists: 0 }],
      teamB: [{ username: 'player-one', strengthScore: 19, statsAvailable: false,
        games: 0, wins: 0, goals: 0, assists: 0 }],
      teamAScore: 20, teamBScore: 19, playersWithStats: 1, totalPlayers: 2
    };
    sessionService.teamSuggestion.and.returnValue(of(preview));
    component.generateTeams('EXCEL_POINTS');
    fixture.detectChanges();

    expect(sessionService.teamSuggestion).toHaveBeenCalledWith(7, 'EXCEL_POINTS');
    expect(sessionService.confirmTeams).not.toHaveBeenCalled();
    expect(component.teamsScoreSource).toBe('EXCEL_POINTS');
    expect(component.teamSuggestionPendingConfirmation).toBeTrue();
    const shell: HTMLElement = fixture.nativeElement;
    expect(shell.querySelector('.team-generator-excel-action')).toBeTruthy();
    expect(shell.querySelector('.team-suggestion')?.textContent).toContain('20');
    expect(shell.querySelector('.team-suggestion')?.textContent).toContain('Sem pontuação associada');
  });

  it('confirms the same selected Excel ranking source and can switch back to form', () => {
    (component as any).currentUsername = 'creator-user';
    component.session = {
      ...session, joined: true, creatorUsername: 'creator-user',
      communityId: 9, sport: 'Futebol', teamBalanceSupported: true, participantCount: 10, maxParticipants: 10, status: 'FULL'
    };
    component.generateTeams('EXCEL_POINTS');
    component.confirmTeams();
    expect(sessionService.confirmTeams).toHaveBeenCalledWith(7, 'EXCEL_POINTS');
    expect(component.teamSuggestionPendingConfirmation).toBeFalse();

    component.generateTeams('FORM');
    expect(sessionService.teamSuggestion).toHaveBeenCalledWith(7, 'FORM');
    expect(component.teamsScoreSource).toBe('FORM');
    expect(component.teamSuggestionPendingConfirmation).toBeTrue();
  });

  it('should not confirm the same team suggestion twice', () => {
    (component as any).currentUsername = 'creator-user';
    component.session = {
      ...session,
      creatorUsername: 'creator-user',
      joined: true,
      communityId: 9, sport: 'Futebol', teamBalanceSupported: true,
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


  it('hides the team generator for individual and undecided singles/doubles sports', () => {
    (component as any).currentUsername = 'creator-user';
    for (const sport of ['Atletismo', 'Ciclismo', 'Padel', 'Ténis']) {
      component.session = {
        ...session, creatorUsername: 'creator-user', sport,
        teamBalanceSupported: false, communityId: 9,
        participantCount: 10, maxParticipants: 10, status: 'FULL'
      };
      fixture.detectChanges();
      expect(component.canGenerateTeams()).withContext(sport).toBeFalse();
      expect(fixture.nativeElement.querySelector('.team-generator')).toBeNull();
    }
    expect(sessionService.teamSuggestion).not.toHaveBeenCalled();
  });

  it('supports different confirmed team rosters only when the API declares eligibility', () => {
    (component as any).currentUsername = 'creator-user';
    for (const size of [4, 6, 8, 10, 12, 14]) {
      component.session = {
        ...session, creatorUsername: 'creator-user', sport: 'Futebol',
        teamBalanceSupported: true, communityId: 9,
        participantCount: size, maxParticipants: size, status: 'FULL'
      };
      expect(component.canGenerateTeams()).withContext(String(size)).toBeTrue();
    }
    component.session = { ...component.session!, participantCount: 9, maxParticipants: 10 };
    expect(component.canGenerateTeams()).toBeFalse();
    component.session = { ...component.session!, participantCount: 10, maxParticipants: 10, teamBalanceSupported: false };
    expect(component.canGenerateTeams()).toBeFalse();
  });

  it('distinguishes cancelling removal from the destructive confirm action', () => {
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

    component.participants = [participant];
    component.showAttendanceManager = true;
    component.requestRemoveParticipant(participant);
    fixture.detectChanges();

    const confirm = fixture.nativeElement.querySelector('.confirm-remove-action') as HTMLButtonElement;
    const cancel = fixture.nativeElement.querySelector('.cancel-remove-action') as HTMLButtonElement;
    expect(confirm).toBeTruthy();
    expect(cancel).toBeTruthy();
    expect(confirm.classList.contains('jynlo-action--danger')).toBeTrue();
    expect(cancel.classList.contains('jynlo-action--neutral')).toBeTrue();
    expect(cancel.classList.contains('jynlo-action--danger')).toBeFalse();
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

  it('confirms all pending players with one click', () => {
    (component as any).currentUsername = 'creator-user';
    component.session = { ...session, gameDate: '2020-10-01T18:00:00Z', joined: true };
    component.showAttendanceManager = true;
    component.participants = [
      { id: 15, username: 'ana', attendanceStatus: 'PENDING', joinedAt: '2026-09-20T18:00:00Z' },
      { id: 16, username: 'rui', attendanceStatus: 'PENDING', joinedAt: '2026-09-20T18:00:00Z' }
    ];
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('.confirm-bulk-attendance') as HTMLButtonElement;
    expect(button.textContent).toContain('Confirmar presença de todos');
    button.click();

    expect(reliabilityService.recordAttendance).toHaveBeenCalledWith(7, 15, 'ATTENDED');
    expect(reliabilityService.recordAttendance).toHaveBeenCalledWith(7, 16, 'ATTENDED');
    expect(component.participants.map(p => p.attendanceStatus)).toEqual(['ATTENDED', 'ATTENDED']);
    expect(component.canConfirmPendingAttendance()).toBeFalse();
  });

  it('switches label after a no-show and preserves prior decisions', () => {
    (component as any).currentUsername = 'creator-user';
    component.session = { ...session, gameDate: '2020-10-01T18:00:00Z', joined: true };
    component.showAttendanceManager = true;
    component.participants = [
      { id: 15, username: 'ana', attendanceStatus: 'NO_SHOW', joinedAt: '2026-09-20T18:00:00Z' },
      { id: 16, username: 'rui', attendanceStatus: 'PENDING', joinedAt: '2026-09-20T18:00:00Z' },
      { id: 17, username: 'leo', attendanceStatus: 'ATTENDED', joinedAt: '2026-09-20T18:00:00Z' },
      { id: 18, username: 'luis', attendanceStatus: 'LATE_CANCELLED', joinedAt: '2026-09-20T18:00:00Z' }
    ];
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('.confirm-bulk-attendance') as HTMLButtonElement;
    expect(button.textContent).toContain('Confirmar presença dos restantes jogadores');
    button.click();

    expect(reliabilityService.recordAttendance).toHaveBeenCalledTimes(1);
    expect(reliabilityService.recordAttendance).toHaveBeenCalledWith(7, 16, 'ATTENDED');
    expect(component.participants.map(p => p.attendanceStatus))
      .toEqual(['NO_SHOW', 'ATTENDED', 'ATTENDED', 'LATE_CANCELLED']);
  });

  it('keeps failed bulk updates pending and reports partial success', () => {
    (component as any).currentUsername = 'creator-user';
    component.session = { ...session, gameDate: '2020-10-01T18:00:00Z', joined: true };
    component.participants = [
      { id: 15, username: 'ana', attendanceStatus: 'PENDING', joinedAt: '2026-09-20T18:00:00Z' },
      { id: 16, username: 'rui', attendanceStatus: 'PENDING', joinedAt: '2026-09-20T18:00:00Z' }
    ];
    reliabilityService.recordAttendance.and.callFake((_sessionId, participantId) =>
      participantId === 15 ? of(void 0) : throwError(() => new Error('failure'))
    );
    component.confirmPendingAttendance();
    expect(component.participants.map(p => p.attendanceStatus)).toEqual(['ATTENDED', 'PENDING']);
    expect(component.attendanceSuccess).toContain('1');
    expect(component.attendanceError).toContain('1 de 2');
    expect(component.canConfirmPendingAttendance()).toBeTrue();
  });

  it('blocks bulk attendance before the half-hour delay and for non-organisers', () => {
    component.participants = [
      { id: 15, username: 'ana', attendanceStatus: 'PENDING', joinedAt: '2026-09-20T18:00:00Z' }
    ];
    (component as any).currentUsername = 'creator-user';
    component.session = {
      ...session, gameDate: new Date(Date.now() - 29 * 60_000).toISOString(), joined: true
    };
    expect(component.canConfirmPendingAttendance()).toBeFalse();
    component.confirmPendingAttendance();
    expect(reliabilityService.recordAttendance).not.toHaveBeenCalled();

    component.session = { ...session, gameDate: '2020-10-01T18:00:00Z', joined: true };
    (component as any).currentUsername = 'someone-else';
    expect(component.canConfirmPendingAttendance()).toBeFalse();
  });

  it('offers an explicit choice only after a recorded absence and allows undo', () => {
    (component as any).currentUsername = 'creator-user';
    component.session = { ...session, joined: true, gameDate: '2020-10-01T18:00:00Z' };
    component.showAttendanceManager = true;
    const absent = { id: 15, username: 'ana', attendanceStatus: 'NO_SHOW' as const,
      joinedAt: '2026-09-20T18:00:00Z' };
    sessionService.participants.and.returnValue(of([absent]));
    component.loadParticipants();

    expect(sessionService.futureExclusionStatus).toHaveBeenCalledWith(7, 15);
    expect(component.futureExclusions[15]).toBeFalse();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.future-exclusion-request') as HTMLButtonElement).click();
    expect(sessionService.excludeFromFutureSessions).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('ana');

    fixture.detectChanges();
    const reason = fixture.nativeElement.querySelector('.future-exclusion-reason') as HTMLSelectElement;
    expect(reason).not.toBeNull();
    expect((fixture.nativeElement.querySelector('.future-exclusion-confirm') as HTMLButtonElement).disabled).toBeTrue();
    reason.value = 'NO_SHOW';
    reason.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.future-exclusion-confirm') as HTMLButtonElement).click();
    expect(sessionService.excludeFromFutureSessions).toHaveBeenCalledWith(7, 15, 'NO_SHOW');
    expect(component.futureExclusions[15]).toBeTrue();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.future-exclusion-undo')).not.toBeNull();

    // Undo remains accessible even if the attendance record is subsequently corrected.
    absent.attendanceStatus = 'ATTENDED' as any;
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.future-exclusion-undo') as HTMLButtonElement).click();
    expect(sessionService.allowFutureSessions).toHaveBeenCalledWith(7, 15);
    expect(component.futureExclusions[15]).toBeFalse();
  });

  it('requires an explicit reason and does not allow restrictions by outsiders', () => {
    const participant = { id: 15, username: 'ana', attendanceStatus: 'PENDING' as const,
      joinedAt: '2026-09-20T18:00:00Z' };
    (component as any).currentUsername = 'creator-user';
    component.session = { ...session, joined: true, gameDate: '2020-10-01T18:00:00Z' };
    component.futureExclusions[15] = false;
    component.requestFutureExclusion(participant);
    expect(component.pendingFutureExclusionId).toBe(15);
    component.confirmFutureExclusion(participant);
    expect(sessionService.excludeFromFutureSessions).not.toHaveBeenCalled();
    component.chooseFutureExclusionReason(participant, 'NO_SHOW');
    expect(component.pendingFutureExclusionReason).toBe('');
    component.cancelFutureExclusion();

    (component as any).currentUsername = 'outsider';
    component.requestFutureExclusion(participant);
    expect(component.pendingFutureExclusionId).toBeNull();
    expect(sessionService.excludeFromFutureSessions).not.toHaveBeenCalled();
  });

  it('shows confirmed guest team members by name without creating a profile link', () => {
    component.guestRequests = [
      {id: 501,name:'Afonso Salvador',status:'APPROVED',teamCode:'A',note:''},
      {id: 502,name:'João Marques',status:'APPROVED',teamCode:'B',note:''},
      {id: 503,name:'Outro',status:'CANCELLED',teamCode:'A',note:''}
    ];
    spyOn(component,'isCreator').and.returnValue(true);
    expect(component.guestTeamParticipants('A').map(item=>item.name)).toEqual(['Afonso Salvador']);
    expect(component.guestTeamParticipants('B').map(item=>item.name)).toEqual(['João Marques']);
    component.confirmedTeams=false;
    expect(component.hasConfirmedTeams()).toBeTrue();
  });

  it('lets the organizer restrict a present player for lack of fair play without changing attendance', () => {
    (component as any).currentUsername = 'creator-user';
    component.session = { ...session, joined: true, gameDate: '2020-10-01T18:00:00Z' };
    component.showAttendanceManager = true;
    const player = { id: 15, username: 'ana', attendanceStatus: 'ATTENDED' as const,
      joinedAt: '2026-09-20T18:00:00Z' };
    sessionService.participants.and.returnValue(of([player]));
    component.loadParticipants();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.future-exclusion-request')).not.toBeNull();
    (fixture.nativeElement.querySelector('.future-exclusion-request') as HTMLButtonElement).click();
    fixture.detectChanges();
    const reason = fixture.nativeElement.querySelector('.future-exclusion-reason') as HTMLSelectElement;
    expect(Array.from(reason.options).some(option => option.value === 'NO_SHOW')).toBeFalse();
    reason.value = 'UNSPORTING_CONDUCT';
    reason.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(component.pendingFutureExclusionReason).toBe('UNSPORTING_CONDUCT');
    (fixture.nativeElement.querySelector('.future-exclusion-confirm') as HTMLButtonElement).click();
    expect(sessionService.excludeFromFutureSessions).toHaveBeenCalledOnceWith(7, 15, 'UNSPORTING_CONDUCT');
    expect(player.attendanceStatus).toBe('ATTENDED');
    expect(component.futureExclusions[15]).toBeTrue();

    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.future-exclusion-undo') as HTMLButtonElement).click();
    expect(sessionService.allowFutureSessions).toHaveBeenCalledOnceWith(7, 15);
    expect(component.futureExclusions[15]).toBeFalse();
  });

  it('shows a recoverable error when restriction status cannot be loaded', () => {
    (component as any).currentUsername = 'creator-user';
    component.session = { ...session, joined: true, gameDate: '2020-10-01T18:00:00Z' };
    component.showAttendanceManager = true;
    sessionService.futureExclusionStatus.and.returnValue(throwError(() => new Error('unavailable')));
    sessionService.participants.and.returnValue(of([
      { id: 15, username: 'ana', attendanceStatus: 'NO_SHOW', joinedAt: '2026-09-20T18:00:00Z' }
    ]));
    component.loadParticipants();
    expect(component.futureExclusions[15]).toBeNull();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.future-exclusion-request')).toBeNull();
    const retryButton = fixture.nativeElement.querySelector('.future-exclusion-undo') as HTMLButtonElement;
    expect(retryButton).not.toBeNull();
    expect(retryButton.textContent).toContain('Tentar novamente');
    expect(fixture.nativeElement.textContent).toContain('Não foi possível verificar');

    retryButton.click();
    expect(sessionService.participants).toHaveBeenCalledTimes(2);
    expect(sessionService.futureExclusionStatus).toHaveBeenCalledTimes(2);
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
