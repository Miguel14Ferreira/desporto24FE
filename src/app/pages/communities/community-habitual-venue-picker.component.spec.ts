import { of } from 'rxjs';
import { CommunityHabitualVenuePickerComponent } from './community-habitual-venue-picker.component';
import { CommunityGroup } from '../model/community-group';
import { Venue } from '../model/venue';

describe('Community habitual venue picker', () => {
  const group = {id: 42, name: 'ACM', myRole: 'OWNER', sport: 'Futebol',
    sports: ['Futebol'], defaultVenueId: null} as CommunityGroup;
  const venue = {id: 55, name: 'Campo Municipal', city: 'Lisboa',
    district: 'Lisboa', address: 'Rua da Bola', sports: 'Futebol',
    latitude: 38.71, longitude: -9.13} as Venue;

  function setup() {
    const venues = {
      suggest: jasmine.createSpy('suggest').and.returnValue(of({
        venues: [venue], page: 0, hasMore: false
      })),
      get: jasmine.createSpy('get').and.returnValue(of(venue)),
      resolveMapLink: jasmine.createSpy('resolveMapLink').and.returnValue(of({
        latitude: 38.71, longitude: -9.13, resolvedUrl: 'https://www.google.com/maps'
      })),
      reverseLocation: jasmine.createSpy('reverseLocation').and.returnValue(of({
        city: 'Lisboa', address: 'Rua da Bola', distanceMeters: 4, provider: 'OSM'
      }))
    };
    const groups = {
      updateDefaultVenue: jasmine.createSpy('updateDefaultVenue').and.callFake(
        (_id: number, id: number | null) =>
          of({...group, defaultVenueId: id, defaultVenueName: id ? venue.name : null})
      ),
      updateHabitualLocation: jasmine.createSpy('updateHabitualLocation').and.callFake(
        (_id: number, source: 'GPS' | 'MAPS', lat: number, lng: number,
          city: string | null, address: string | null) =>
          of({...group, habitualLocationSource: source,
            habitualLatitude: lat, habitualLongitude: lng,
            habitualCity: city, habitualAddress: address})
      )
    };
    const component = new CommunityHabitualVenuePickerComponent(venues as any, groups as any);
    component.community = {...group};
    return {component, venues, groups};
  }

  it('opens a catalogue venue detail without silently making it the default', () => {
    const {component, venues, groups} = setup();
    component.query = 'campo';
    component.search();
    expect(venues.suggest).toHaveBeenCalled();
    expect(groups.updateDefaultVenue).not.toHaveBeenCalled();
    component.openDetails(55);
    expect(component.expanded?.id).toBe(55);
    expect(groups.updateDefaultVenue).not.toHaveBeenCalled();
    component.save(55);
    expect(groups.updateDefaultVenue).toHaveBeenCalledWith(42, 55);
    expect(component.community.defaultVenueId).toBe(55);
  });

  it('resolves and saves a Google Maps point without creating a fake catalog venue', () => {
    const {component, venues, groups} = setup();
    component.chooseLocationMethod('maps');
    component.mapLink = 'https://www.google.com/maps?q=38.71,-9.13';
    component.resolveMapLink();
    expect(venues.resolveMapLink).toHaveBeenCalled();
    expect(component.locationPoint?.source).toBe('MAPS');
    expect(component.locationPoint?.city).toBe('Lisboa');
    component.savePoint();
    expect(groups.updateHabitualLocation).toHaveBeenCalledWith(
      42, 'MAPS', 38.71, -9.13, 'Lisboa', 'Rua da Bola');
    expect(groups.updateDefaultVenue).not.toHaveBeenCalled();
  });

  it('supports a GPS location point without forcing a directory venue', () => {
    const {component, groups} = setup();
    component.chooseLocationMethod('gps');
    component.locationPoint = {source: 'GPS', latitude: 38.7, longitude: -9.2,
      city: '', address: ''};
    component.savePoint();
    expect(groups.updateHabitualLocation).toHaveBeenCalledWith(
      42, 'GPS', 38.7, -9.2, null, null);
  });

  it('does not allow an ordinary member to change location preferences', () => {
    const {component, groups} = setup();
    component.community = {...group, myRole: 'MEMBER'};
    component.query = 'campo';
    component.search();
    component.openDetails(55);
    component.chooseLocationMethod('maps');
    component.mapLink = 'https://www.google.com/maps';
    component.resolveMapLink();
    component.savePoint();
    expect(groups.updateDefaultVenue).not.toHaveBeenCalled();
    expect(groups.updateHabitualLocation).not.toHaveBeenCalled();
  });

  it('clears stale catalogue results when switching to Google Maps', () => {
    const {component} = setup();
    component.query = 'campo';
    component.search();
    expect(component.results.length).toBe(1);
    component.chooseLocationMethod('maps');
    expect(component.results).toEqual([]);
    expect(component.expanded).toBeNull();
  });
});
