import { Router } from '@angular/router';
import { of, Subject } from 'rxjs';

import { VenueCreateComponent } from './venue-create.component';
import { VenueService, ResolveVenueMapLinkResponse } from '../../services/venue.service';

describe('Venue browser GPS response consistency', () => {
  let component: VenueCreateComponent;
  let venueService: jasmine.SpyObj<VenueService>;
  let onSuccess: PositionCallback[];
  let onError: PositionErrorCallback[];

  const position = (latitude: number, longitude: number): GeolocationPosition =>
    ({ coords: { latitude, longitude } } as GeolocationPosition);

  beforeEach(() => {
    venueService = jasmine.createSpyObj<VenueService>('VenueService', ['resolveMapLink', 'submitSuggestion']);
    const router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    component = new VenueCreateComponent(venueService, router);
    onSuccess = [];
    onError = [];
    spyOn(navigator.geolocation, 'getCurrentPosition').and.callFake((success, error) => {
      onSuccess.push(success);
      if (error) onError.push(error);
    });
  });

  it('does not overwrite manually edited coordinates when a browser GPS result is late', () => {
    component.useCurrentLocation();
    expect(component.locating).toBeTrue();
    component.latitude = 40.344;
    component.longitude = -8.588;
    component.onManualCoordinatesChanged();

    onSuccess[0](position(38.7, -9.1));

    expect(component.latitude).toBe(40.344);
    expect(component.longitude).toBe(-8.588);
    expect(component.locating).toBeFalse();
    expect(component.locationError).toBeFalse();
  });

  it('keeps newly resolved Maps coordinates when an older GPS result arrives', () => {
    venueService.resolveMapLink.and.returnValue(of({
      resolvedUrl: 'https://www.google.com/maps', latitude: 40.2, longitude: -8.4
    }));
    component.useCurrentLocation();
    component.mapLink = 'https://www.google.com/maps?q=40.2,-8.4';
    component.resolveMapLink();

    onSuccess[0](position(38.7, -9.1));

    expect(component.latitude).toBe(40.2);
    expect(component.longitude).toBe(-8.4);
    expect(component.mapLinkResolved).toBeTrue();
    expect(component.locating).toBeFalse();
  });

  it('ignores a pending Maps result after the user requests the browser GPS instead', () => {
    const oldMaps = new Subject<ResolveVenueMapLinkResponse>();
    venueService.resolveMapLink.and.returnValue(oldMaps);
    component.mapLink = 'https://www.google.com/maps?q=40.2,-8.4';
    component.resolveMapLink();
    component.useCurrentLocation();

    oldMaps.next({ resolvedUrl: component.mapLink, latitude: 40.2, longitude: -8.4 });
    onSuccess[0](position(41.15, -8.61));

    expect(component.latitude).toBe(41.15);
    expect(component.longitude).toBe(-8.61);
    expect(component.mapLinkResolved).toBeFalse();
    expect(component.resolvingMapLink).toBeFalse();
  });

  it('ignores obsolete GPS failures after changing location source', () => {
    component.useCurrentLocation();
    component.onMapLinkChanged();
    onError[0]({} as GeolocationPositionError);
    expect(component.locationError).toBeFalse();
    expect(component.locating).toBeFalse();

    component.useCurrentLocation();
    onSuccess[0](position(38.7, -9.1)); // superseded callback
    expect(component.latitude).toBeNull();
    onSuccess[1](position(40.2, -8.4));
    expect(component.latitude).toBe(40.2);
    expect(component.longitude).toBe(-8.4);
  });
});
