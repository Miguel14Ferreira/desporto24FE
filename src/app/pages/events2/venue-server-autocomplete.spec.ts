import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { Events2Component } from './events2.component';
import { Venue } from '../model/venue';
import { VenueService, VenueSuggestionPage } from '../../services/venue.service';
import { SessionService } from '../../services/session.service';
import { TEST_IMPORTS, TEST_PROVIDERS } from '../../testing/test-providers';

describe('Create session venue server autocomplete', () => {
  let component: Events2Component;
  let fixture: ComponentFixture<Events2Component>;
  let venues: jasmine.SpyObj<VenueService>;
  const venue = (id: number, name: string, city = 'Porto'): Venue => ({
    id, name, city, address: 'Rua A', sports: 'Padel',
    latitude: null, longitude: null
  } as Venue);
  const page = (items: Venue[], n = 0, more = false): VenueSuggestionPage => ({
    venues: items, page: n, hasMore: more
  });

  beforeEach(async () => {
    venues = jasmine.createSpyObj<VenueService>('VenueService', [
      'suggest', 'search', 'create', 'listPhotos', 'resolveMapLink', 'enableLegacySuggestions'
    ]);
    venues.suggest.and.returnValue(of(page([])));
    venues.listPhotos.and.returnValue(of([]));
    await TestBed.configureTestingModule({
      declarations: [Events2Component],
      imports: TEST_IMPORTS,
      providers: [
        ...TEST_PROVIDERS,
        { provide: VenueService, useValue: venues },
        { provide: SessionService, useValue: jasmine.createSpyObj<SessionService>('SessionService', ['create']) }
      ]
    }).compileComponents();
    fixture = TestBed.createComponent(Events2Component);
    component = fixture.componentInstance;
    spyOn(TestBed.inject(Router), 'navigate').and.returnValue(Promise.resolve(true));
    fixture.detectChanges();
  });

  it('does not download all venues before the user picks a sport', () => {
    expect(venues.search).not.toHaveBeenCalled();
    expect(venues.suggest).not.toHaveBeenCalled();
    component.sport = 'Padel';
    component.confirmSportSelection();
    expect(venues.suggest).toHaveBeenCalledWith('', '', 'Padel', 0);
    expect(venues.search).not.toHaveBeenCalled();
  });

  it('debounces typing and keeps the search editable while loading', fakeAsync(() => {
    const pending = new Subject<VenueSuggestionPage>();
    venues.suggest.and.returnValue(pending.asObservable());
    component.sport = 'Padel';
    fixture.detectChanges();
    tick();
    expect(component.sportSelected).toBeTrue();
    component.onVenueSearchChanged('Pavilhão');
    tick(299);
    expect(venues.suggest).not.toHaveBeenCalled();
    tick(1);
    expect(venues.suggest).toHaveBeenCalledWith('Pavilhão', '', 'Padel', 0);
    fixture.detectChanges();
    expect((fixture.nativeElement.querySelector('input[name="venueSearch"]') as HTMLInputElement).disabled)
      .toBeFalse();
    pending.next(page([venue(4, 'Pavilhão')]));
    pending.complete();
    expect(component.venueOptions.map(v => v.id)).toEqual([4]);
  }));

  it('offers a deliberate fallback when old backend routes /suggest to /{id} and fails', () => {
    venues.suggest.and.returnValues(
      throwError(() => ({ status: 500 })),
      throwError(() => ({ status: 500 })), // component retries once
      of(page([venue(2, 'Pavilhão Municipal')]))
    );
    component.sport = 'Padel';
    component.loadVenues();
    expect(component.venuesLoadError).toBeTrue();
    expect(component.legacyVenueRetryAvailable).toBeTrue();
    expect(venues.enableLegacySuggestions).not.toHaveBeenCalled();
    fixture.detectChanges();
    const fallback = Array.from(fixture.nativeElement.querySelectorAll('button'))
      .find((item: any) => item.textContent.includes('Usar pesquisa de compatibilidade')) as HTMLButtonElement;
    expect(fallback).toBeDefined();
    fallback.click();
    expect(venues.enableLegacySuggestions).toHaveBeenCalledTimes(1);
    expect(component.venueOptions.map(item => item.id)).toEqual([2]);
    expect(component.venuesLoadError).toBeFalse();
  });

  it('never offers full-catalog fallback for authentication errors', () => {
    venues.suggest.and.returnValue(throwError(() => ({ status: 403 })));
    component.sport = 'Padel';
    component.loadVenues();
    expect(component.venuesLoadError).toBeTrue();
    expect(component.legacyVenueRetryAvailable).toBeFalse();
    component.useLegacyVenueSearch();
    expect(venues.enableLegacySuggestions).not.toHaveBeenCalled();
  });

  it('can load a later page and select a venue not found on the first 40', () => {
    const first = Array.from({ length: 40 }, (_, i) => venue(i + 1, 'Campo ' + i));
    venues.suggest.and.returnValues(of(page(first, 0, true)), of(page([venue(101, 'Campo Porto')], 1)));
    component.sport = 'Padel';
    component.loadVenues();
    expect(component.venueOptions.length).toBe(40);
    fixture.detectChanges();
    const more = Array.from(fixture.nativeElement.querySelectorAll('button'))
      .find((item: any) => item.textContent.includes('Mostrar mais recintos')) as HTMLButtonElement;
    expect(more).toBeDefined();
    more.click();
    expect(venues.suggest).toHaveBeenCalledWith('', '', 'Padel', 1);
    expect(component.venueOptions.some(v => v.id === 101)).toBeTrue();
    component.venueSearch = 'Campo Porto · Porto';
    component.confirmVenueSelection();
    expect(component.selectedVenueId).toBe(101);
  });

  it('ignores stale responses and keeps newest suggestion results', fakeAsync(() => {
    const old = new Subject<VenueSuggestionPage>();
    const latest = new Subject<VenueSuggestionPage>();
    venues.suggest.and.returnValues(old.asObservable(), latest.asObservable());
    component.sport = 'Padel';
    component.onVenueSearchChanged('Antigo');
    tick(300);
    component.onVenueSearchChanged('Novo');
    tick(300);
    latest.next(page([venue(2, 'Novo')]));
    latest.complete();
    old.next(page([venue(1, 'Antigo')]));
    old.complete();
    expect(component.venues.map(v => v.id)).toEqual([2]);
    expect(component.venuesLoading).toBeFalse();
  }));

  it('queries the chosen city field separately from the venue name', fakeAsync(() => {
    component.sport = 'Padel';
    component.onCityChanged('Porto');
    tick(300);
    expect(venues.suggest).toHaveBeenCalledWith('', 'Porto', 'Padel', 0);
  }));

  it('separates a selected datalist label into venue name and city', fakeAsync(() => {
    component.sport = 'Padel';
    component.onVenueSearchChanged('Pavilhão Municipal · Évora');
    tick(300);
    expect(venues.suggest).toHaveBeenCalledWith('Pavilhão Municipal', 'Évora', 'Padel', 0);
  }));

  it('does not select a name-only result if more matches may be on later pages', () => {
    venues.suggest.and.returnValue(of(page([venue(1, 'Pavilhão')], 0, true)));
    component.sport = 'Padel';
    component.venueSearch = 'Pavilhão';
    component.loadVenues();
    component.confirmVenueSelection();
    expect(component.selectedVenueId).toBeNull();
  });
});
