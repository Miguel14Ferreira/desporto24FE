import { Component } from '@angular/core';

import { SPORTS_CATALOG } from '../../shared/sports-catalog';
import { VenueOwnershipType } from '../model/venue';

@Component({
  selector: 'app-venue-create',
  templateUrl: './venue-create.component.html',
  styleUrls: ['./venue-create.component.css'],
  standalone: false
})
export class VenueCreateComponent {
  readonly sportsCatalog = SPORTS_CATALOG;
  name = '';
  city = '';
  address = '';
  sports = '';
  venueType = '';
  ownershipType: VenueOwnershipType | null = null;
  surfaceType = '';
}
