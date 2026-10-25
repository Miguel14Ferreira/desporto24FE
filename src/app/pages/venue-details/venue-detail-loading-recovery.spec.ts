import { ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { BehaviorSubject, NEVER, of, Subject, throwError } from 'rxjs';
import { fakeAsync, tick } from '@angular/core/testing';
import { VenueDetailsComponent } from './venue-details.component';
import { VenueService } from '../../services/venue.service';
import { Venue } from '../model/venue';

describe('Venue detail fail-safe loading', () => {
  const initial: Venue = { id: 7, name: 'Pavilhão de Teste' } as Venue;
  let ids: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let service: jasmine.SpyObj<VenueService>;
  let cdr: jasmine.SpyObj<ChangeDetectorRef>;
  let component: VenueDetailsComponent;

  beforeEach(() => {
    ids = new BehaviorSubject(convertToParamMap({ id: '7' }));
    const route = { paramMap: ids.asObservable(), snapshot: {paramMap: ids.value} } as any as ActivatedRoute;
    service = jasmine.createSpyObj<VenueService>('VenueService',
      ['get', 'listPhotos', 'listSportConditions', 'getRatingSummary']);
    cdr = jasmine.createSpyObj<ChangeDetectorRef>('ChangeDetectorRef', ['markForCheck']);
    service.get.and.returnValue(of(initial));
    service.listPhotos.and.returnValue(of([]));
    service.listSportConditions.and.returnValue(of([]));
    service.getRatingSummary.and.returnValue(of({
      venueId:7, ratingCount:0, averageScore:null
    }));
    component = new VenueDetailsComponent(route, service, cdr);
  });

  afterEach(() => component.ngOnDestroy());

  it('renders loaded details and marks Angular to redraw the page', () => {
    component.ngOnInit();
    expect(component.venue?.name).toBe('Pavilhão de Teste');
    expect(component.loading).toBeFalse();
    expect(component.loadError).toBeFalse();
    expect(cdr.markForCheck).toHaveBeenCalled();
  });

  it('clears the loading indicator and shows the retry state on an HTTP error', () => {
    service.get.and.returnValue(throwError(() => new Error('network')));
    component.ngOnInit();
    expect(component.loading).toBeFalse();
    expect(component.loadError).toBeTrue();
    expect(cdr.markForCheck).toHaveBeenCalled();
  });

  it('leaves the spinner after 12 seconds even if the API never responds', fakeAsync(() => {
    service.get.and.returnValue(NEVER);
    component.ngOnInit();
    expect(component.loading).toBeTrue();
    tick(12_100);
    expect(component.loading).toBeFalse();
    expect(component.loadError).toBeTrue();
    expect(cdr.markForCheck).toHaveBeenCalled();
  }));

  it('handles navigation from one venue to another in the same component', () => {
    const next = {...initial, id:8, name:'Piscina de Teste'} as Venue;
    service.get.and.callFake(id => of(id === 7 ? initial : next));
    component.ngOnInit();
    ids.next(convertToParamMap({id:'8'}));
    expect(service.get).toHaveBeenCalledWith(8);
    expect(service.listPhotos).toHaveBeenCalledWith(8);
    expect(component.venue?.name).toBe('Piscina de Teste');
  });

  it('never shows an old request result after switching to another venue', () => {
    const slow = new Subject<Venue>();
    service.get.and.returnValues(slow.asObservable(),
      of({...initial, id:8, name:'Recinto novo'} as Venue));
    component.ngOnInit();
    ids.next(convertToParamMap({id:'8'}));
    slow.next(initial);
    expect(component.venue?.name).toBe('Recinto novo');
    expect(component.loading).toBeFalse();
  });

  it('shows an error immediately when an invalid venue id is supplied', () => {
    ids.next(convertToParamMap({id:'bad'}));
    component.ngOnInit();
    expect(service.get).not.toHaveBeenCalled();
    expect(component.loading).toBeFalse();
    expect(component.loadError).toBeTrue();
  });
});
