import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';

import { HomeComponent } from './home.component';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { I18nService } from '../../i18n/i18n.service';
import { SessionService } from '../../services/session.service';
import { VenueService } from '../../services/venue.service';
import { SessionSummary } from '../model/session-summary';
import { Venue } from '../model/venue';
import { VenueSportsBadgesComponent } from '../../shared/venue-sports-badges/venue-sports-badges.component';

describe('HomeComponent public discovery', () => {
  let sessions: jasmine.SpyObj<SessionService>;
  let venues: jasmine.SpyObj<VenueService>;

  const session = (id: number, overrides: Partial<SessionSummary> = {}): SessionSummary => ({
    id, sport: 'Futebol', city: 'Cascais',
    gameDate: new Date(Date.now() + 86_400_000).toISOString(),
    distanceKm: null, participantCount: 3, maxParticipants: 10,
    priceAmount: 0, privateGame: false, audience: 'PUBLIC',
    status: 'OPEN', ...overrides
  });

  const venue = (id: number, sports: string | null): Venue =>
    ({ id, name: 'Campo ' + id, city: 'Cascais', address: 'Rua Central',
       sports, informationSource: 'OFFICIAL' } as Venue);

  beforeEach(async () => {
    sessions = jasmine.createSpyObj<SessionService>('SessionService', ['discover']);
    venues = jasmine.createSpyObj<VenueService>('VenueService', ['suggest']);
    sessions.discover.and.returnValue(of([]));
    venues.suggest.and.returnValue(of({ venues: [], page: 0, hasMore: false }));

    await TestBed.configureTestingModule({
      declarations: [HomeComponent],
      imports: [CommonModule, TranslatePipe, VenueSportsBadgesComponent, RouterModule.forRoot([])],
      providers: [
        { provide: SessionService, useValue: sessions },
        { provide: VenueService, useValue: venues }
      ]
    }).compileComponents();
  });

  function render(): ComponentFixture<HomeComponent> {
    const fixture = TestBed.createComponent(HomeComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('uses the approved premium Concept One landing while retaining working discovery links', () => {
    const fixture = render();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.jynlo-home-premium')).not.toBeNull();
    expect(root.querySelector('main.hero[aria-labelledby="jynlo-home-title"]')).not.toBeNull();
    expect(root.querySelector('.jynlo-premium-features')?.querySelectorAll('article').length).toBe(3);
    expect(root.querySelector('.public-discovery form.preview-search')).not.toBeNull();
    expect(root.querySelector('a[href="#jynlo-public-discovery"]')).not.toBeNull();
    expect(root.querySelectorAll('a.preview-item').length).toBe(0);
  });

  it('makes public sessions discoverable without signing up and explains communities', () => {
    const fixture = render();
    const root = fixture.nativeElement as HTMLElement;
    const exploreLink = root.querySelector<HTMLAnchorElement>('a[href="#jynlo-public-discovery"]');
    const publicResults = root.querySelector<HTMLElement>('section#jynlo-public-discovery');
    const communitySection = root.querySelector<HTMLElement>('section.community-teaser');
    const communityCta = root.querySelector<HTMLAnchorElement>('a.community-teaser-cta');

    expect(exploreLink).not.toBeNull();
    expect(publicResults).not.toBeNull();
    expect(communitySection?.querySelector('h2')?.textContent?.trim()).toBeTruthy();
    expect(communityCta?.getAttribute('href')).toBe('/login/registerNewUser');
    expect(root.querySelectorAll('.hero-actions a[href="/login/registerNewUser"]').length).toBe(1);
  });

  it('shows real upcoming public sessions and no private, closed or community-only activities', () => {
    sessions.discover.and.returnValue(of([
      session(1), session(2, { privateGame: true }),
      session(3, { audience: 'COMMUNITY_ONLY' }),
      session(4, { status: 'CANCELLED' }),
      session(5, { gameDate: new Date(Date.now() - 86_400_000).toISOString() }),
      session(6, { status: 'FULL' })
    ]));
    venues.suggest.and.returnValue(of({ venues: [venue(10, 'Futebol'), venue(11, null)], page: 0, hasMore: false }));

    const fixture = render();
    const component = fixture.componentInstance;
    expect(sessions.discover).toHaveBeenCalledWith(jasmine.objectContaining({
      privateGame: false,
      from: jasmine.any(String)
    }));
    expect(component.featuredSessions.map(value => value.id)).toEqual([1, 6]);
    expect(component.featuredVenues.map(value => value.id)).toEqual([10]);
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('a.preview-item').length).toBe(2);
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('.preview-venue').length).toBe(1);
  });

  it('does not invent sessions or venues when the public catalogue is empty', () => {
    const fixture = render();
    expect(fixture.componentInstance.featuredSessions).toEqual([]);
    expect(fixture.componentInstance.featuredVenues).toEqual([]);
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('.preview-state').length).toBe(2);
    expect((fixture.nativeElement as HTMLElement).querySelector('.preview-cta')).not.toBeNull();
  });

  it('finds complete venues after an incomplete first page without downloading the whole catalogue', () => {
    venues.suggest.and.callFake((_name?: string, _city?: string, _sport?: string, page = 0) =>
      of(page === 0
        ? { venues: [venue(11, null)], page: 0, hasMore: true }
        : { venues: [venue(12, 'Basquetebol'), venue(13, 'Futebol')], page, hasMore: false }));

    const fixture = render();
    expect(venues.suggest).toHaveBeenCalledTimes(2);
    expect(fixture.componentInstance.featuredVenues.map(value => value.id)).toEqual([12, 13]);
    expect(fixture.componentInstance.venuesLoading).toBeFalse();
    expect(fixture.componentInstance.venuesLoadError).toBeFalse();
  });

  it('limits public venue discovery to three pages even when no venue has a sport', () => {
    venues.suggest.and.callFake((_name?: string, _city?: string, _sport?: string, page = 0) =>
      of({ venues: [venue(20 + page, '  ')], page, hasMore: true }));

    const fixture = render();
    expect(venues.suggest).toHaveBeenCalledTimes(3);
    expect(fixture.componentInstance.featuredVenues).toEqual([]);
    expect(fixture.componentInstance.venuesLoading).toBeFalse();
  });

  it('keeps usable venues if loading a subsequent page fails', () => {
    venues.suggest.and.callFake((_name?: string, _city?: string, _sport?: string, page = 0) =>
      page === 0
        ? of({ venues: [venue(34, 'Andebol')], page, hasMore: true })
        : throwError(() => new Error('temporary server error')));

    const fixture = render();
    expect(fixture.componentInstance.featuredVenues.map(value => value.id)).toEqual([34]);
    expect(fixture.componentInstance.venuesLoadError).toBeFalse();
    expect(fixture.componentInstance.venuesLoading).toBeFalse();
  });

  it('searches sessions and bounded venues by the selected sport and locality', () => {
    const fixture = render();
    const element = fixture.nativeElement as HTMLElement;
    const sport = element.querySelector('input[name="sport"]') as HTMLInputElement;
    const city = element.querySelector('input[name="city"]') as HTMLInputElement;
    sport.value = 'Padel';
    city.value = 'Lisboa';

    const form = element.querySelector('form.preview-search') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    expect(sessions.discover).toHaveBeenCalledWith(jasmine.objectContaining({
      sport: 'Padel', city: 'Lisboa', privateGame: false
    }));
    expect(venues.suggest).toHaveBeenCalledWith(undefined, 'Lisboa', 'Padel', 0);
    expect(form.getAttribute('action')).toBeNull();
  });

  it('clears public filters and requests the unfiltered catalogue again', () => {
    const fixture = render();
    const element = fixture.nativeElement as HTMLElement;
    const sport = element.querySelector('input[name="sport"]') as HTMLInputElement;
    const city = element.querySelector('input[name="city"]') as HTMLInputElement;
    sport.value = 'Futebol';
    city.value = 'Cascais';
    (element.querySelector('button[type="button"]') as HTMLButtonElement).click();

    expect(sport.value).toBe('');
    expect(city.value).toBe('');
    expect(sessions.discover).toHaveBeenCalledTimes(2);
    expect(sessions.discover).toHaveBeenCalledWith(jasmine.objectContaining({
      sport: '', city: '', privateGame: false
    }));
    expect(venues.suggest).toHaveBeenCalledWith(undefined, undefined, undefined, 0);
  });

  it('ignores results from a superseded public search', () => {
    const first = new Subject<SessionSummary[]>();
    const second = new Subject<SessionSummary[]>();
    sessions.discover.and.returnValues(first.asObservable(), second.asObservable());

    const fixture = render();
    fixture.componentInstance.searchPublic(new Event('submit'), 'Padel', 'Lisboa');

    second.next([session(42, { sport: 'Padel', city: 'Lisboa' })]);
    first.next([session(88)]);
    fixture.detectChanges();

    expect(fixture.componentInstance.featuredSessions.map(value => value.id)).toEqual([42]);
    expect(fixture.componentInstance.sessionsLoading).toBeFalse();
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('a.preview-item').length).toBe(1);
  });

  it('shows truthful one, many and full availability states in public session cards', () => {
    sessions.discover.and.returnValue(of([
      session(101, { participantCount: 9, maxParticipants: 10 }),
      session(102, { participantCount: 6, maxParticipants: 10 }),
      session(103, { status: 'FULL', participantCount: 4, maxParticipants: 10 })
    ]));

    const fixture = render();
    const i18n = TestBed.inject(I18nService);
    const cards = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLAnchorElement>('a.preview-item')
    );
    expect(cards.length).toBe(3);
    expect(cards[0].querySelector('.preview-availability')?.textContent?.trim())
      .toBe(i18n.translate('home.preview.oneSpot', { count: 1 }));
    expect(cards[1].querySelector('.preview-availability')?.textContent?.trim())
      .toBe(i18n.translate('home.preview.manySpots', { count: 4 }));
    expect(cards[2].querySelector('.preview-availability')?.textContent?.trim())
      .toBe(i18n.translate('home.preview.full'));
    expect(cards[2].querySelector('.preview-availability--full')).not.toBeNull();
    expect(cards[2].getAttribute('href')).toContain('/sessions/103');
  });

  it('does not invent available places from invalid or absent public counts', () => {
    sessions.discover.and.returnValue(of([
      session(104, { maxParticipants: 0 }),
      session(105, { participantCount: -1 }),
      session(106, { participantCount: Number.NaN })
    ]));

    const fixture = render();
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('a.preview-item').length).toBe(3);
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('.preview-availability').length).toBe(0);
    expect(fixture.componentInstance.remainingSpots(session(107, { maxParticipants: 0 }))).toBeNull();
  });

  it('shows a full state when a public session has reached its valid capacity', () => {
    sessions.discover.and.returnValue(of([
      session(108, { status: 'OPEN', participantCount: 10, maxParticipants: 10 })
    ]));

    const fixture = render();
    expect(fixture.componentInstance.remainingSpots(session(109, {
      status: 'OPEN', participantCount: 11, maxParticipants: 10
    }))).toBe(0);
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('.preview-availability--full').length).toBe(1);
  });

  it('allows a guest to retry a failed public request without login', () => {
    sessions.discover.and.returnValues(
      throwError(() => new Error('temporary outage')),
      of([session(201)])
    );

    const fixture = render();
    const retry = (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('button.preview-retry');
    expect(retry).not.toBeNull();
    expect(retry?.type).toBe('button');

    retry?.click();
    fixture.detectChanges();

    expect(sessions.discover).toHaveBeenCalledTimes(2);
    expect(fixture.componentInstance.featuredSessions.map(item => item.id)).toEqual([201]);
    expect((fixture.nativeElement as HTMLElement).querySelector('button.preview-retry')).toBeNull();
  });

  it('retries the last applied filters rather than unsubmitted input edits', () => {
    sessions.discover.and.returnValues(
      of([]),
      throwError(() => new Error('temporary outage')),
      of([session(202, { sport: 'Padel', city: 'Lisboa' })])
    );

    const fixture = render();
    const root = fixture.nativeElement as HTMLElement;
    const sportInput = root.querySelector<HTMLInputElement>('input[name="sport"]')!;
    const cityInput = root.querySelector<HTMLInputElement>('input[name="city"]')!;
    sportInput.value = 'Padel';
    cityInput.value = 'Lisboa';
    root.querySelector<HTMLFormElement>('form.preview-search')!.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true })
    );
    fixture.detectChanges();

    // Editing without submitting must not silently change the retry criteria.
    sportInput.value = 'Futebol';
    cityInput.value = 'Porto';
    root.querySelector<HTMLButtonElement>('button.preview-retry')!.click();

    expect(sessions.discover).toHaveBeenCalledTimes(3);
    expect(sessions.discover.calls.mostRecent().args[0]).toEqual(
      jasmine.objectContaining({ sport: 'Padel', city: 'Lisboa', privateGame: false })
    );
    expect(venues.suggest.calls.mostRecent().args).toEqual([
      undefined, 'Lisboa', 'Padel', 0
    ]);
  });

  it('degrades gracefully when a public request fails', () => {
    sessions.discover.and.returnValue(throwError(() => new Error('backend offline')));
    venues.suggest.and.returnValue(throwError(() => new Error('backend offline')));

    const fixture = render();
    expect(fixture.componentInstance.sessionsLoading).toBeFalse();
    expect(fixture.componentInstance.venuesLoading).toBeFalse();
    expect(fixture.componentInstance.sessionsLoadError).toBeTrue();
    expect(fixture.componentInstance.venuesLoadError).toBeTrue();
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('.preview-state').length).toBe(2);
  });
});
