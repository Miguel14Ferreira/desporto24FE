import { SocialFeedComponent } from './social-feed.component';
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
      {} as SocialFeedService, {} as SessionService, auth
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
