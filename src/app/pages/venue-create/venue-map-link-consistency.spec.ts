import { ActivatedRoute, Router } from '@angular/router';
import { of, Subject } from 'rxjs';
import { VenueCreateComponent } from './venue-create.component';
import { VenueService, ResolveVenueMapLinkResponse } from '../../services/venue.service';
import { Venue } from '../model/venue';

describe('Venue Maps link coordinate consistency', () => {
  let component: VenueCreateComponent;
  let venueService: jasmine.SpyObj<VenueService>;

  const coords = (latitude: number, longitude: number): ResolveVenueMapLinkResponse => ({
    latitude, longitude, resolvedUrl: 'https://www.google.com/maps'
  });

  beforeEach(() => {
    venueService = jasmine.createSpyObj<VenueService>('VenueService', ['resolveMapLink', 'submitSuggestion']);
    const router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    component = new VenueCreateComponent(venueService, router, undefined as unknown as ActivatedRoute);
  });

  it('clears coordinates derived from a previous Maps link when the link changes', () => {
    venueService.resolveMapLink.and.returnValue(of(coords(38.7, -9.1)));
    component.mapLink = 'https://maps.app.goo.gl/first';
    component.resolveMapLink();
    expect(component.latitude).toBe(38.7);
    expect(component.mapLinkResolved).toBeTrue();

    component.mapLink = 'https://maps.app.goo.gl/second';
    component.onMapLinkChanged();

    expect(component.latitude).toBeNull();
    expect(component.longitude).toBeNull();
    expect(component.mapLinkResolved).toBeFalse();
  });

  it('preserves manually entered coordinates when the Maps link changes', () => {
    component.latitude = 41.15;
    component.longitude = -8.61;
    component.onManualCoordinatesChanged();
    component.mapLink = 'https://maps.app.goo.gl/other';
    component.onMapLinkChanged();
    expect(component.latitude).toBe(41.15);
    expect(component.longitude).toBe(-8.61);
  });

  it('does not let an old Maps response overwrite a newer result', () => {
    const first = new Subject<ResolveVenueMapLinkResponse>();
    venueService.resolveMapLink.and.returnValues(first.asObservable(), of(coords(40.2, -8.4)));
    component.mapLink = 'https://maps.app.goo.gl/old';
    component.resolveMapLink();
    component.mapLink = 'https://maps.app.goo.gl/new';
    component.onMapLinkChanged();
    component.resolveMapLink();
    first.next(coords(38.7, -9.1));
    first.complete();

    expect(component.latitude).toBe(40.2);
    expect(component.longitude).toBe(-8.4);
    expect(component.mapLinkResolved).toBeTrue();
    expect(component.resolvingMapLink).toBeFalse();
    expect(component.mapLinkError).toBeFalse();
  });

  it('ignores errors from a superseded Maps link', () => {
    const old = new Subject<ResolveVenueMapLinkResponse>();
    venueService.resolveMapLink.and.returnValues(old.asObservable(), of(coords(40.2, -8.4)));
    component.mapLink = 'https://maps.app.goo.gl/old';
    component.resolveMapLink();
    component.mapLink = 'https://maps.app.goo.gl/new';
    component.onMapLinkChanged();
    component.resolveMapLink();
    old.error(new Error('old timeout'));
    expect(component.mapLinkError).toBeFalse();
    expect(component.mapLinkResolved).toBeTrue();
  });

  it('manual edits after resolving a link survive a subsequent link change', () => {
    venueService.resolveMapLink.and.returnValue(of(coords(38.7, -9.1)));
    component.mapLink = 'https://maps.app.goo.gl/first';
    component.resolveMapLink();
    component.latitude = 39.0;
    component.onManualCoordinatesChanged();
    component.mapLink = 'https://maps.app.goo.gl/second';
    component.onMapLinkChanged();
    expect(component.latitude).toBe(39.0);
    expect(component.longitude).toBe(-9.1);
  });

  it('submits the new resolved coordinates, not values from the old link', () => {
    venueService.resolveMapLink.and.returnValues(of(coords(38.7, -9.1)), of(coords(40.2, -8.4)));
    venueService.submitSuggestion.and.returnValue(of({id:9,status:'PENDING'}));
    component.name = 'Recinto do Porto';
    component.city = 'Porto';
    component.address = 'Rua Central';
    component.selectedSports = ['Futsal'];
    component.environmentType = 'OUTDOOR';
    component.mapLink = 'https://maps.app.goo.gl/old';
    component.resolveMapLink();
    component.mapLink = 'https://maps.app.goo.gl/new';
    component.onMapLinkChanged();
    component.resolveMapLink();
    component.save();

    expect(venueService.submitSuggestion).toHaveBeenCalledWith(
      jasmine.objectContaining({ latitude: 40.2, longitude: -8.4 })
    );
  });
});
