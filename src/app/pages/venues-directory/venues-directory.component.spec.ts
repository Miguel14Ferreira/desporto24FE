import { ActivatedRoute, convertToParamMap } from '@angular/router';
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
    api = jasmine.createSpyObj<VenueService>('VenueService', ['suggest']);
    api.suggest.and.returnValue(of(page([venue])));
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
});
