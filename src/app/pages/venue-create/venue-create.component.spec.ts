import { Router } from '@angular/router';
import { of } from 'rxjs';

import { VenueService } from '../../services/venue.service';
import { Venue } from '../model/venue';
import { VenueCreateComponent } from './venue-create.component';

describe('VenueCreateComponent', () => {
  it('does not submit when required fields are missing', () => {
    const venueService = jasmine.createSpyObj<VenueService>('VenueService', ['create']);
    const router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    const component = new VenueCreateComponent(venueService, router);

    component.name = 'Pavilhão Central';
    component.city = '';
    component.address = 'Rua do Desporto';

    component.save();

    expect(venueService.create).not.toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(component.validationError).toBeTrue();
    expect(component.saving).toBeFalse();
  });

  it('creates the venue and navigates to its detail page', () => {
    const venueService = jasmine.createSpyObj<VenueService>('VenueService', ['create']);
    const router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    const venue = {
      id: 7,
      name: 'Pavilhão Central'
    } as Venue;

    venueService.create.and.returnValue(of(venue));

    const component = new VenueCreateComponent(venueService, router);
    component.name = '  Pavilhão Central  ';
    component.city = '  Lisboa  ';
    component.address = '  Rua do Desporto  ';
    component.sports = '  Futsal  ';

    component.save();

    expect(venueService.create).toHaveBeenCalledOnceWith(jasmine.objectContaining({
      name: 'Pavilhão Central',
      city: 'Lisboa',
      address: 'Rua do Desporto',
      sports: 'Futsal',
      latitude: null,
      longitude: null
    }));
    expect(router.navigate).toHaveBeenCalledOnceWith(['/menu/venues', 7]);
    expect(component.validationError).toBeFalse();
    expect(component.saveError).toBeFalse();
    expect(component.saving).toBeFalse();
  });
});
