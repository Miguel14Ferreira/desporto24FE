import { SocialFeedComponent } from './social-feed.component';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { SessionDetail } from '../model/session-detail';
import { SocialFeedService } from '../../services/social-feed.service';
import { SessionService } from '../../services/session.service';
import { AuthenticationService } from '../../services/authethication.service';
import { FeedItem } from '../model/feed-item';

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
      { snapshot: { queryParamMap: convertToParamMap({}) } } as unknown as ActivatedRoute
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
    expect(component.shareFeedbackMessage).toContain('Seleciona a ligação');
    expect(component.sharingSessionId).toBeNull();
  });

  it('does not show a manual link after successfully copying the public URL', async () => {
    makeNativeSharingUnavailable();
    const copy = spyOn<any>(component, 'copyShareUrl').and.returnValue(Promise.resolve());

    await component.shareSession(item);

    expect(copy).toHaveBeenCalledWith(new URL('/sessions/42', window.location.origin).href);
    expect(component.shareFeedbackMessage).toBe('Ligação copiada');
    expect(component.manualShareItem).toBeNull();
    expect(component.manualShareUrl).toBe('');
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
    const sessions = jasmine.createSpyObj<SessionService>('SessionService', ['discover', 'detail']);
    sessions.discover.and.returnValue(of([]));
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
    const target = new SocialFeedComponent(feed, sessions, auth, route);
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
