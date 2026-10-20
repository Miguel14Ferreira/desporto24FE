import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';

import { HomeComponent } from './home.component';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { SessionService } from '../../services/session.service';
import { VenueService } from '../../services/venue.service';
import { SessionSummary } from '../model/session-summary';
import { Venue } from '../model/venue';

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
      imports: [TranslatePipe],
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
