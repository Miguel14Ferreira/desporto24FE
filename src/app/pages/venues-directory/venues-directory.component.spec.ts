import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { RouterTestingModule } from '@angular/router/testing';
import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { ChangeDetectorRef } from '@angular/core';
import { VenuesDirectoryComponent } from './venues-directory.component';
import { VenueService, VenueSuggestionPage } from '../../services/venue.service';
import { Venue } from '../model/venue';

describe('VenuesDirectoryComponent', () => {
  let component: VenuesDirectoryComponent;
  let api: jasmine.SpyObj<VenueService>;
  const venue = { id: 15, name: 'Pavilhão Municipal', city: 'Lisboa', district: 'Lisboa',
    sports: 'Futsal, Voleibol', address: null, informationSource: 'OPENSTREETMAP' } as unknown as Venue;
  const page = (venues: Venue[], hasMore = false): VenueSuggestionPage =>
    ({ venues, page: 0, hasMore });
  beforeEach(() => {
    api = jasmine.createSpyObj<VenueService>('VenueService', ['suggest', 'nearbyCity']);
    api.suggest.and.returnValue(of(page([venue])));
    api.nearbyCity.and.returnValue(of({ referenceCity: 'Lisboa', radiusKm: 25,
      referenceAvailable: true, venues: [], page: 0, hasMore: false }));
    component = new VenuesDirectoryComponent(api,
      { snapshot: { queryParamMap: convertToParamMap({ district: 'Lisboa' }) } } as ActivatedRoute,
      { markForCheck: () => {} } as ChangeDetectorRef);
  });

  it('includes both autonomous regions and queries them using the existing paginated endpoint', () => {
    expect(component.districts).toContain('Açores');
    expect(component.districts).toContain('Madeira');
    expect(component.districts.length).toBe(20);
    component.district = 'Madeira';
    component.search();
    expect(api.suggest).toHaveBeenCalledWith('', '', '', 0, 'Madeira');
    component.district = 'Açores';
    component.search();
    expect(api.suggest).toHaveBeenCalledWith('', '', '', 0, 'Açores');
  });

  it('loads the first page by district and displays real returned venues', () => {
    component.ngOnInit();
    expect(api.suggest).toHaveBeenCalledOnceWith('', '', '', 0, 'Lisboa');
    expect(component.venues.map(x => x.id)).toEqual([15]);
    expect(component.loading).toBeFalse();
    expect(component.sports(venue)).toEqual(['Futsal', 'Voleibol']);
    component.ngOnDestroy();
  });

  it('supports bounded pagination without loading the entire national catalogue', () => {
    api.suggest.and.returnValue(of(page([venue], true)));
    component.ngOnInit();
    expect(component.hasMore).toBeTrue();
    component.search(1);
    expect(api.suggest).toHaveBeenCalledWith('', '', '', 1, 'Lisboa');
    component.ngOnDestroy();
  });

  it('shows a recoverable error rather than endless loading', () => {
    api.suggest.and.returnValue(throwError(() => new Error('offline')));
    component.ngOnInit();
    expect(component.loading).toBeFalse();
    expect(component.loadError).toBeTrue();
    api.suggest.and.returnValue(of(page([venue])));
    component.search();
    expect(component.venues.length).toBe(1);
    expect(component.loadError).toBeFalse();
    component.ngOnDestroy();
  });

  it('ignores stale results from an older filter', () => {
    const old = new Subject<VenueSuggestionPage>();
    api.suggest.and.returnValues(old.asObservable(), of(page([venue])));
    component.ngOnInit();
    component.district = 'Porto';
    component.search();
    old.next(page([{ ...venue, id: 99, city: 'Beja' }]));
    old.complete();
    expect(component.venues[0].id).toBe(15);
    component.ngOnDestroy();
  });
  it('restores the filtered page when returning from a venue detail', () => {
    const restored = new VenuesDirectoryComponent(api,
      { snapshot: { queryParamMap: convertToParamMap({
        page: '2', district: 'Lisboa', city: 'Oeiras', name: 'Campo'
      }) } } as ActivatedRoute,
      { markForCheck: () => {} } as ChangeDetectorRef);
    restored.ngOnInit();
    expect(api.suggest).toHaveBeenCalledOnceWith('Campo', 'Oeiras', '', 2, 'Lisboa');
    expect(restored.page).toBe(2);
    restored.ngOnDestroy();
  });

  it('keeps filters, result heading and catalogue cards visually separated', async () => {
    await TestBed.configureTestingModule({
      imports: [VenuesDirectoryComponent, RouterTestingModule],
      providers: [
        { provide: VenueService, useValue: api },
        { provide: ActivatedRoute, useValue: {
          snapshot: { queryParamMap: convertToParamMap({ district: 'Lisboa' }) }
        } }
      ]
    }).compileComponents();
    const rendered = TestBed.createComponent(VenuesDirectoryComponent);
    rendered.detectChanges();
    const root: HTMLElement = rendered.nativeElement;
    const filters = root.querySelector<HTMLElement>('.venue-directory-filters');
    const heading = root.querySelector<HTMLElement>('.venue-directory-result-heading');
    const cards = root.querySelectorAll<HTMLElement>('.venue-directory-card');
    expect(filters).not.toBeNull();
    expect(heading).not.toBeNull();
    expect(cards.length).toBe(1);
    const narrow = window.matchMedia('(max-width: 620px)').matches;
    expect(getComputedStyle(filters!).gap).toBe(narrow ? '14px' : '16px');
    expect(getComputedStyle(heading!).marginTop).toBe(narrow ? '20px' : '24px');
    rendered.destroy();
  });


  it('offers nearby search only on sparse first-page city queries without silently dropping filters', () => {
    component.city = 'Cacém';
    component.district = '';
    component.search();
    expect(component.canSearchNearby).toBeTrue();
    component.name = 'Campo';
    expect(component.canSearchNearby).toBeFalse();
    component.name = '';
    component.district = 'Lisboa';
    expect(component.canSearchNearby).toBeFalse();
    component.district = '';
    api.suggest.and.returnValue(of(page([venue], true)));
    component.search();
    expect(component.canSearchNearby).toBeFalse();
    component.ngOnDestroy();
  });

  it('shows saved neighbour cities and distances only when explicitly requested', () => {
    component.city = 'Cacém';
    component.district = '';
    const neighbour = { ...venue, id: 71, city: 'Sintra' } as Venue;
    api.nearbyCity.and.returnValue(of({ referenceCity: 'Cacém', radiusKm: 25,
      referenceAvailable: true, venues: [{ venue: neighbour, distanceKm: 4.2 }],
      page: 0, hasMore: true }));
    component.searchNearby();
    expect(api.nearbyCity).toHaveBeenCalledOnceWith('Cacém', '', 0, 25);
    expect(component.venues.map(v => v.city)).toEqual(['Sintra']);
    expect(component.nearbyDistanceById[71]).toBe(4.2);
    expect(component.hasMore).toBeTrue();
    component.browsePage(1);
    expect(api.nearbyCity).toHaveBeenCalledWith('Cacém', '', 1, 25);
    component.search();
    expect(component.nearbyMode).toBeFalse();
    expect(component.nearbyDistanceById[71]).toBeUndefined();
    component.ngOnDestroy();
  });

  it('never invents distances if there is no saved city GPS reference', () => {
    component.city = 'Cacém';
    component.district = '';
    api.nearbyCity.and.returnValue(of({ referenceCity: 'Cacém', radiusKm: 25,
      referenceAvailable: false, venues: [], page: 0, hasMore: false }));
    component.searchNearby();
    expect(component.nearbyReferenceAvailable).toBeFalse();
    expect(component.venues).toEqual([]);
    expect(component.nearbyDistanceById).toEqual({});
    component.ngOnDestroy();
  });

  it('ignores old nearby responses after returning to standard search', () => {
    const pending = new Subject<any>();
    component.city = 'Cacém';
    component.district = '';
    api.nearbyCity.and.returnValue(pending.asObservable());
    component.searchNearby();
    component.search();
    pending.next({ referenceAvailable: true, hasMore: true,
      venues: [{ venue, distanceKm: 1 }], page: 0 });
    pending.complete();
    expect(component.nearbyMode).toBeFalse();
    expect(component.venues.map(v => v.id)).toEqual([15]);
    expect(component.nearbyDistanceById).toEqual({});
    component.ngOnDestroy();
  });

  it('restores nearby radius and pagination from filtered venue detail links', () => {
    const restored = new VenuesDirectoryComponent(api,
      { snapshot: { queryParamMap: convertToParamMap({
        nearby: '1', page: '2', radiusKm: '50', city: 'Cacém', sport: 'Padel'
      }) } } as ActivatedRoute,
      { markForCheck: () => {} } as ChangeDetectorRef);
    restored.ngOnInit();
    expect(restored.nearbyMode).toBeTrue();
    expect(restored.nearbyRadiusKm).toBe(50);
    expect(api.nearbyCity).toHaveBeenCalledWith('Cacém', 'Padel', 2, 50);
    restored.ngOnDestroy();
  });

  it('ignores invalid page parameters rather than requesting an unsafe page', () => {
    const restored = new VenuesDirectoryComponent(api,
      { snapshot: { queryParamMap: convertToParamMap({ page: '-100', district: 'Lisboa' }) } } as ActivatedRoute,
      { markForCheck: () => {} } as ChangeDetectorRef);
    restored.ngOnInit();
    expect(api.suggest).toHaveBeenCalledOnceWith('', '', '', 0, 'Lisboa');
    restored.ngOnDestroy();
  });

});
