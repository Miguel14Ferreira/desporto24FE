import { SocialFeedComponent } from './social-feed.component';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { SessionDetail } from '../model/session-detail';
import { SocialFeedService } from '../../services/social-feed.service';
import { SessionService } from '../../services/session.service';
import { CommunityService } from '../../services/community.service';
import { AuthenticationService } from '../../services/authethication.service';
import { FeedItem } from '../model/feed-item';
import { appTranslate as t } from '../../i18n/i18n.service';
import { TEST_IMPORTS, TEST_PROVIDERS } from '../../testing/test-providers';

describe('SocialFeedComponent discovery sidebar', () => {
  let fixture: ComponentFixture<SocialFeedComponent>;
  let component: SocialFeedComponent;
  let feed: jasmine.SpyObj<SocialFeedService>;
  let sessions: jasmine.SpyObj<SessionService>;
  let community: jasmine.SpyObj<CommunityService>;

  beforeEach(async () => {
    feed = jasmine.createSpyObj<SocialFeedService>('SocialFeedService', ['feed']);
    feed.feed.and.returnValue(of([]));
    sessions = jasmine.createSpyObj<SessionService>('SessionService', ['discover', 'mine', 'detail']);
    sessions.discover.and.returnValue(of([]));
    sessions.mine.and.returnValue(of({ created: [], joined: [], waitlisted: [] }));
    community = jasmine.createSpyObj<CommunityService>('CommunityService', ['discoverProfiles']);
    community.discoverProfiles.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      declarations: [SocialFeedComponent],
      imports: TEST_IMPORTS,
      providers: [
        ...TEST_PROVIDERS,
        { provide: SocialFeedService, useValue: feed },
        { provide: SessionService, useValue: sessions },
        { provide: CommunityService, useValue: community }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(SocialFeedComponent);
    component = fixture.componentInstance;
  });

  it('keeps the discovery sidebar available when the feed contains posts', fakeAsync(() => {
    const post: FeedItem = {
      type: 'POST', postId: 1, authorUsername: 'jogador',
      authorDisplayName: 'Jogador', authorProfilePicUrl: null,
      content: 'Bora jogar?', imageUrl: null,
      createdAt: new Date().toISOString(), sessionId: null,
      sport: null, city: null, gameDate: null,
      likeCount: 0, likedByMe: false, commentCount: 0
    };
    feed.feed.and.returnValue(of([post]));
    sessions.discover.and.returnValue(of([{
      id: 24, sport: 'Padel', city: 'Lisboa',
      gameDate: new Date(Date.now() + 86_400_000).toISOString(),
      distanceKm: null, participantCount: 2, maxParticipants: 4,
      priceAmount: 0, privateGame: false, status: 'OPEN', audience: 'PUBLIC'
    }]));

    fixture.detectChanges();
    tick(351);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.feed-layout .feed-main .composer')).not.toBeNull();
    expect(root.querySelector('.feed-main .feed-list .feed-card')).not.toBeNull();
    const aside = root.querySelector('.feed-layout > .feed-sidebar') as HTMLElement;
    expect(aside).not.toBeNull();
    expect(aside.querySelector('.feed-suggested-session')?.getAttribute('href'))
      .toBe('/menu/events/24');
    expect(aside.querySelector('a[href="/menu/perfis"]')).not.toBeNull();
  }));

  it('shows up to three genuine public profiles and excludes the current player', fakeAsync(() => {
    const candidate = (username: string) => ({
      username, nickname: null, fullName: username, country: 'Portugal',
      location: 'Lisboa', favoriteSports: 'Padel', bio: null,
      skillLevel: null, availability: null, age: null,
      profilePicUrl: null, joinDateDisplay: null
    });
    community.discoverProfiles.and.returnValue(of([
      candidate('miguel'), candidate('ana'), candidate('bruno'),
      candidate('carla'), candidate('diogo')
    ]));

    fixture.detectChanges();
    tick(351);
    fixture.detectChanges();

    expect(community.discoverProfiles).toHaveBeenCalledTimes(1);
    expect(component.suggestedPeople.map(person => person.username))
      .toEqual(['ana', 'bruno', 'carla']);
    const links = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLAnchorElement>(
        '.feed-sidebar .feed-suggested-person'
      )
    );
    expect(links.map(link => link.getAttribute('href')))
      .toEqual([
        '/menu/perfis/ana?from=feed',
        '/menu/perfis/bruno?from=feed',
        '/menu/perfis/carla?from=feed'
      ]);
    expect(links[0].textContent).toContain('Padel');
  }));

  it('keeps the people search available if profile discovery fails', fakeAsync(() => {
    community.discoverProfiles.and.returnValue(
      throwError(() => new Error('Profiles unavailable'))
    );
    fixture.detectChanges();
    tick(351);
    fixture.detectChanges();

    const aside = fixture.nativeElement.querySelector('.feed-sidebar') as HTMLElement;
    expect(component.suggestedPeople).toEqual([]);
    expect(aside.querySelector('.feed-suggested-person')).toBeNull();
    expect(aside.querySelector('a[href="/menu/perfis"]')).not.toBeNull();
  }));

  it('keeps discovery links visible when no sessions are suggested', fakeAsync(() => {
    fixture.detectChanges();
    tick(351);
    fixture.detectChanges();

    const aside = fixture.nativeElement.querySelector('.feed-sidebar') as HTMLElement;
    expect(aside).not.toBeNull();
    expect(aside.querySelector('.feed-suggested-session')).toBeNull();
    expect(aside.querySelector('a[href="/menu/events"]')).not.toBeNull();
    expect(aside.querySelector('a[href="/menu/perfis"]')).not.toBeNull();
  }));
});

describe('SocialFeedComponent session sharing fallback', () => {
  let component: SocialFeedComponent;
  let item: FeedItem;

  beforeEach(() => {
    const auth = jasmine.createSpyObj<AuthenticationService>(
      'AuthenticationService', ['isLoggedIn']
    );
    auth.isLoggedIn.and.returnValue(true);
    component = new SocialFeedComponent(
      {} as SocialFeedService, {} as SessionService, auth,
      { snapshot: { queryParamMap: convertToParamMap({}) } } as unknown as ActivatedRoute,
      {} as CommunityService
    );
    item = {
      type: 'POST',
      postId: 1,
      authorUsername: 'player',
      authorDisplayName: 'Player',
      authorProfilePicUrl: null,
      content: 'Bora jogar?',
      imageUrl: null,
      createdAt: '2026-10-12T12:00:00Z',
      sessionId: 42,
      sport: 'Padel',
      city: 'Lisboa',
      gameDate: '2026-10-14T18:00:00Z',
      likeCount: 0,
      likedByMe: false,
      commentCount: 0
    };
  });

  function makeNativeSharingUnavailable(): void {
    if (typeof navigator.share === 'function') {
      spyOn(navigator, 'share').and.returnValue(Promise.reject(new Error('Native sharing unavailable')));
    }
  }

  it('shows a manual public link when native sharing and clipboard both fail', async () => {
    makeNativeSharingUnavailable();
    spyOn<any>(component, 'copyShareUrl').and.returnValue(Promise.reject(new Error('Clipboard denied')));

    await component.shareSession(item);

    expect(component.manualShareItem).toBe(item);
    expect(component.manualShareUrl).toBe(new URL('/sessions/42', window.location.origin).href);
    expect(component.shareFeedbackMessage).toBe(t('publicSession.selectLink'));
    expect(component.sharingSessionId).toBeNull();
  });

  it('does not show a manual link after successfully copying the public URL', async () => {
    makeNativeSharingUnavailable();
    const copy = spyOn<any>(component, 'copyShareUrl').and.returnValue(Promise.resolve());

    await component.shareSession(item);

    expect(copy).toHaveBeenCalledWith(new URL('/sessions/42', window.location.origin).href);
    expect(component.shareFeedbackMessage).toBe(t('publicSession.linkCopied'));
    expect(component.manualShareItem).toBeNull();
    expect(component.manualShareUrl).toBe('');
  });

  it('localizes clipboard sharing feedback in English', async () => {
    const previousLanguage = localStorage.getItem('d24-language');
    try {
      localStorage.setItem('d24-language', 'en');
      makeNativeSharingUnavailable();
      spyOn<any>(component, 'copyShareUrl').and.returnValue(Promise.resolve());

      await component.shareSession(item);

      expect(component.shareFeedbackMessage).toBe('Link copied');
    } finally {
      if (previousLanguage === null) {
        localStorage.removeItem('d24-language');
      } else {
        localStorage.setItem('d24-language', previousLanguage);
      }
    }
  });

  it('clears an earlier manual link when sharing another session', async () => {
    makeNativeSharingUnavailable();
    const copy = spyOn<any>(component, 'copyShareUrl')
      .and.returnValue(Promise.reject(new Error('Clipboard denied')));
    await component.shareSession(item);

    const nextItem = { ...item, postId: 2, sessionId: 43 };
    copy.and.returnValue(Promise.resolve());
    await component.shareSession(nextItem);

    expect(component.manualShareItem).toBeNull();
    expect(component.manualShareUrl).toBe('');
    expect(component.shareFeedbackSessionId).toBe(43);
  });

  it('does not share posts without a linked session', async () => {
    const copy = spyOn<any>(component, 'copyShareUrl');
    await component.shareSession({ ...item, sessionId: null });

    expect(copy).not.toHaveBeenCalled();
    expect(component.manualShareUrl).toBe('');
  });
});

describe('SocialFeedComponent post-game entry', () => {
  function openFromSession(overrides: Partial<SessionDetail> = {}, rawId = '42') {
    const auth = jasmine.createSpyObj<AuthenticationService>('AuthenticationService', ['isLoggedIn']);
    auth.isLoggedIn.and.returnValue(true);
    Object.defineProperty(auth, 'loggedInPerfilname', { value: 'participant', configurable: true });

    const feed = jasmine.createSpyObj<SocialFeedService>('SocialFeedService', ['feed']);
    feed.feed.and.returnValue(of([]));
    const sessions = jasmine.createSpyObj<SessionService>('SessionService', ['discover', 'detail', 'mine']);
    sessions.discover.and.returnValue(of([]));
    sessions.mine.and.returnValue(of({ created: [], joined: [], waitlisted: [] }));
    sessions.detail.and.returnValue(of({
      id: 42, sport: 'Padel', city: 'Lisboa',
      gameDate: '2026-10-01T18:00:00Z', status: 'COMPLETED',
      distanceKm: null, participantCount: 4, maxParticipants: 4, priceAmount: 0,
      privateGame: false, canSharePublicly: true, joined: true,
      waitlisted: false, waitlistPosition: null, creatorUsername: 'organizer',
      address: null, canSeeExactAddress: false, gamePhoto: null,
      ...overrides
    } as SessionDetail));
    const route = ({
      snapshot: { queryParamMap: convertToParamMap({ momentSession: rawId }) }
    } as unknown as ActivatedRoute);
    const target = new SocialFeedComponent(
      feed, sessions, auth, route,
      { discoverProfiles: () => of([]) } as CommunityService
    );
    target.ngOnInit();
    return { target, sessions };
  }

  it('prefills a completed public session without publishing a post', () => {
    const { target, sessions } = openFromSession();
    expect(sessions.detail).toHaveBeenCalledWith(42);
    expect(target.selectedSessionId).toBe(42);
    expect(target.postGameSessionId).toBe(42);
    expect(target.filteredSessions.some(session => session.id === 42)).toBeTrue();
    expect(target.postContent).toBe('');
    target.ngOnDestroy();
  });

  it('shows only the verified session in the post-game draft summary', () => {
    const { target } = openFromSession();
    expect(target.postGameSession).toEqual(jasmine.objectContaining({
      id: 42, sport: 'Padel', city: 'Lisboa', status: 'COMPLETED'
    }));
    target.selectedSessionId = 43;
    expect(target.postGameSession).toBeNull();
    target.ngOnDestroy();
  });

  it('detaches the completed session while preserving the draft and photo', () => {
    const { target } = openFromSession();
    target.postContent = 'O melhor momento foi o último ponto!';
    target.postImagePreview = 'blob:my-photo';
    target.postImageFile = new File(['photo'], 'jogo.jpg', { type: 'image/jpeg' });
    const photo = target.postImageFile;

    target.detachPostGameSession();

    expect(target.selectedSessionId).toBeNull();
    expect(target.postGameSessionId).toBeNull();
    expect(target.postGameSession).toBeNull();
    expect(target.postContent).toBe('O melhor momento foi o último ponto!');
    expect(target.postImagePreview).toBe('blob:my-photo');
    expect(target.postImageFile).toBe(photo);
    target.ngOnDestroy();
  });

  it('does not detach the session during publication or if another is selected', () => {
    const { target } = openFromSession();
    target.posting = true;
    target.detachPostGameSession();
    expect(target.selectedSessionId).toBe(42);
    expect(target.postGameSessionId).toBe(42);

    target.posting = false;
    target.selectedSessionId = 99;
    target.detachPostGameSession();
    expect(target.selectedSessionId).toBe(99);
    expect(target.postGameSessionId).toBe(42);
    target.ngOnDestroy();
  });

  it('starts an editable post-game draft from a suggestion without posting', () => {
    const previousLanguage = localStorage.getItem('d24-language');
    localStorage.setItem('d24-language', 'pt');
    const { target } = openFromSession();
    try {
      target.applyPostGamePrompt('feed.postGamePrompt.bestMoment');
      expect(target.postContent).toBe('O melhor momento foi…');

      target.postContent = 'Que grande partida!';
      target.applyPostGamePrompt('feed.postGamePrompt.nextGame');
      expect(target.postContent).toBe('Que grande partida!\nQuem alinha na próxima? 🏃');

      target.applyPostGamePrompt('feed.postGamePrompt.nextGame');
      expect(target.postContent).toBe('Que grande partida!\nQuem alinha na próxima? 🏃');
    } finally {
      target.ngOnDestroy();
      if (previousLanguage === null) {
        localStorage.removeItem('d24-language');
      } else {
        localStorage.setItem('d24-language', previousLanguage);
      }
    }
  });

  it('uses an English prompt when the user has selected English', () => {
    const previousLanguage = localStorage.getItem('d24-language');
    localStorage.setItem('d24-language', 'en');
    const { target } = openFromSession();
    try {
      target.applyPostGamePrompt('feed.postGamePrompt.team');
      expect(target.postContent).toBe('Great game, everyone! 👏');
    } finally {
      target.ngOnDestroy();
      if (previousLanguage === null) {
        localStorage.removeItem('d24-language');
      } else {
        localStorage.setItem('d24-language', previousLanguage);
      }
    }
  });

  it('never replaces a draft or inserts prompts outside the active post-game flow', () => {
    const { target } = openFromSession();
    const prompt = 'feed.postGamePrompt.bestMoment';
    target.postContent = 'x'.repeat(999);
    target.applyPostGamePrompt(prompt);
    expect(target.postContent).toBe('x'.repeat(999));

    target.postContent = 'Meu texto';
    target.selectedSessionId = null;
    target.applyPostGamePrompt(prompt);
    expect(target.postContent).toBe('Meu texto');

    target.selectedSessionId = target.postGameSessionId;
    target.posting = true;
    target.applyPostGamePrompt(prompt);
    expect(target.postContent).toBe('Meu texto');

    target.posting = false;
    target.applyPostGamePrompt('feed.postGamePrompt.unknown');
    expect(target.postContent).toBe('Meu texto');
    target.ngOnDestroy();
  });

  it('does not preselect a private or unrelated completed session', () => {
    for (const overrides of [
      { canSharePublicly: false },
      { privateGame: true },
      { joined: false },
      { status: 'CANCELLED' },
      { id: 99 }
    ]) {
      const { target } = openFromSession(overrides);
      expect(target.selectedSessionId).withContext(JSON.stringify(overrides)).toBeNull();
      expect(target.postGameSessionId).toBeNull();
      target.ngOnDestroy();
    }
  });

  it('ignores invalid or noncanonical session IDs without calling the details API', () => {
    for (const raw of ['0', '00042', '42.0', '-1', '1e2', '9007199254740992']) {
      const { target, sessions } = openFromSession({}, raw);
      expect(sessions.detail).withContext(raw).not.toHaveBeenCalled();
      expect(target.postGameSessionId).toBeNull();
      target.ngOnDestroy();
    }
  });
});

describe('SocialFeedComponent empty-feed session suggestions', () => {
  it('suggests only joinable public games, excluding ones already joined or waitlisted', fakeAsync(() => {
    const auth = jasmine.createSpyObj<AuthenticationService>('AuthenticationService', ['isLoggedIn']);
    auth.isLoggedIn.and.returnValue(true);
    const feed = jasmine.createSpyObj<SocialFeedService>('SocialFeedService', ['feed']);
    feed.feed.and.returnValue(of([]));
    const sessions = jasmine.createSpyObj<SessionService>('SessionService', ['discover', 'mine', 'detail']);
    const candidate = (id: number, status = 'OPEN', privateGame = false, count = 2,
      audience: 'PUBLIC' | 'COMMUNITY_ONLY' = 'PUBLIC') => ({
      id, status, privateGame, audience, sport: 'Futebol', city: 'Lisboa',
      gameDate: new Date(Date.now() + 86_400_000).toISOString(), distanceKm: null,
      participantCount: count, maxParticipants: 10, priceAmount: 0
    });
    sessions.discover.and.returnValue(of([
      candidate(1), candidate(2, 'CANCELLED'), candidate(3, 'OPEN', true),
      candidate(4, 'OPEN', false, 10), candidate(5, 'OPEN', false, 2, 'COMMUNITY_ONLY'),
      { ...candidate(11), joinedByViewer: true },
      { ...candidate(12), waitlistedByViewer: true },
      candidate(6), candidate(7), candidate(8),
      { ...candidate(9), gameDate: new Date(Date.now() - 86_400_000).toISOString() },
      { ...candidate(10), gameDate: 'invalid-date' },
      { ...candidate(13), gameDate: new Date(Date.now() + 3_600_000).toISOString() },
      { ...candidate(14), gameDate: new Date(Date.now() + 3 * 86_400_000).toISOString() }
    ]));
    sessions.mine.and.returnValue(of({ created: [], joined: [], waitlisted: [] }));
    const route = { snapshot: { queryParamMap: convertToParamMap({}) } } as unknown as ActivatedRoute;
    const target = new SocialFeedComponent(
      feed, sessions, auth, route,
      { discoverProfiles: () => of([]) } as CommunityService
    );

    target.ngOnInit();
    tick(351);

    expect(target.suggestedSessions.map(session => session.id)).toEqual([13, 1, 6]);
    expect(sessions.discover).toHaveBeenCalledTimes(1);
    expect(target.items).toEqual([]);
    target.ngOnDestroy();
  }));
});

describe('SocialFeedComponent completed session selection', () => {
  const session = (id: number, status = 'COMPLETED', privateGame = false, audience: 'PUBLIC' | 'COMMUNITY_ONLY' = 'PUBLIC') => ({
    id, sport: 'Futebol', city: 'Parede', gameDate: '2026-10-12T21:00:00Z',
    distanceKm: null, participantCount: 8, maxParticipants: 10, priceAmount: 0,
    privateGame, audience, status
  });

  function openFeed(created: ReturnType<typeof session>[], joined: ReturnType<typeof session>[] = [], waitlisted: ReturnType<typeof session>[] = []) {
    const auth = jasmine.createSpyObj<AuthenticationService>('AuthenticationService', ['isLoggedIn']);
    auth.isLoggedIn.and.returnValue(true);
    const feed = jasmine.createSpyObj<SocialFeedService>('SocialFeedService', ['feed']);
    feed.feed.and.returnValue(of([]));
    const sessions = jasmine.createSpyObj<SessionService>('SessionService', ['discover', 'detail', 'mine']);
    sessions.discover.and.returnValue(of([]));
    sessions.mine.and.returnValue(of({ created, joined, waitlisted }));
    const route = { snapshot: { queryParamMap: convertToParamMap({}) } } as unknown as ActivatedRoute;
    const target = new SocialFeedComponent(
      feed, sessions, auth, route,
      { discoverProfiles: () => of([]) } as CommunityService
    );
    target.ngOnInit();
    return { target, sessions };
  }

  it('lists completed public sessions the player created or joined without a deep link', () => {
    const { target, sessions } = openFeed([session(2)], [session(3)]);
    expect(sessions.mine).toHaveBeenCalledTimes(1);
    expect(target.filteredSessions.map(s => s.id)).toEqual([2, 3]);

    target.onLinkedSessionChange(2);
    expect(target.postGameSessionId).toBe(2);
    expect(target.postGameSession?.sport).toBe('Futebol');
    target.ngOnDestroy();
  });

  it('excludes private, community-only, unfinished and waitlisted sessions', () => {
    const { target } = openFeed([
      session(2), session(4, 'COMPLETED', true),
      session(5, 'COMPLETED', false, 'COMMUNITY_ONLY'),
      session(6, 'CANCELLED'), session(7, 'OPEN')
    ], [session(2)], [session(8)]);
    expect(target.filteredSessions.map(s => s.id)).toEqual([2]);
    target.ngOnDestroy();
  });

  it('filters completed sessions by sport or city and clears the post-game card on deselection', () => {
    const { target } = openFeed([session(2)]);
    target.onSessionSearchChange('basquetebol');
    expect(target.filteredSessions).toEqual([]);
    target.onSessionSearchChange('parede');
    expect(target.filteredSessions.map(s => s.id)).toEqual([2]);
    target.onLinkedSessionChange(2);
    target.onLinkedSessionChange(null);
    expect(target.postGameSessionId).toBeNull();
    expect(target.selectedSessionId).toBeNull();
    target.ngOnDestroy();
  });
});

describe('SocialFeedComponent attendance activity visibility', () => {
  let component: SocialFeedComponent;
  let feed: jasmine.SpyObj<SocialFeedService>;
  let activity: FeedItem;

  beforeEach(() => {
    const auth = jasmine.createSpyObj<AuthenticationService>(
      'AuthenticationService', ['isLoggedIn']
    );
    auth.isLoggedIn.and.returnValue(true);
    Object.defineProperty(auth, 'loggedInPerfilname', { value: 'player', configurable: true });

    feed = jasmine.createSpyObj<SocialFeedService>(
      'SocialFeedService', ['hideAttendanceActivity']
    );
    feed.hideAttendanceActivity.and.returnValue(of(void 0));
    component = new SocialFeedComponent(
      feed, {} as SessionService, auth,
      { snapshot: { queryParamMap: convertToParamMap({}) } } as unknown as ActivatedRoute,
      {} as CommunityService
    );
    activity = {
      type: 'SESSION_ATTENDED', postId: null,
      authorUsername: 'player', authorDisplayName: 'Player',
      authorProfilePicUrl: null, content: null, imageUrl: null,
      createdAt: '2026-10-13T12:00:00Z', sessionId: 42,
      sport: 'Padel', city: 'Lisboa', gameDate: '2026-10-12T18:00:00Z',
      likeCount: 0, likedByMe: false, commentCount: 0
    };
  });

  it('hides only the current player attendance activity after a successful request', () => {
    const otherAuthor = { ...activity, authorUsername: 'friend' };
    const anotherSession = { ...activity, sessionId: 43 };
    const post: FeedItem = { ...activity, type: 'POST', postId: 7 };
    component.items = [activity, otherAuthor, anotherSession, post];

    component.hideAttendanceActivity(activity);

    expect(feed.hideAttendanceActivity).toHaveBeenCalledOnceWith(42);
    expect(component.items).toEqual([otherAuthor, anotherSession, post]);
    expect(component.hidingAttendanceSessionId).toBeNull();
  });

  it('rejects hiding another player activity or non-attendance feed items', () => {
    component.hideAttendanceActivity({ ...activity, authorUsername: 'friend' });
    component.hideAttendanceActivity({ ...activity, type: 'SESSION_CREATED' });
    component.hideAttendanceActivity({ ...activity, sessionId: null });

    expect(feed.hideAttendanceActivity).not.toHaveBeenCalled();
  });

  it('keeps the activity visible and shows an error when hiding fails', () => {
    feed.hideAttendanceActivity.and.returnValue(
      throwError(() => new Error('offline'))
    );
    component.items = [activity];

    component.hideAttendanceActivity(activity);

    expect(component.items).toEqual([activity]);
    expect(component.actionError).toBe(t('feedback.feed.hideAttendanceError'));
    expect(component.hidingAttendanceSessionId).toBeNull();
  });
});
