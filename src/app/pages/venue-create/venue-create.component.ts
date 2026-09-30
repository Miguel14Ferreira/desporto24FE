import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';

import { VenueService } from '../../services/venue.service';

import { SPORTS_CATALOG } from '../../shared/sports-catalog';
import { CreateVenueRequest, VenueOwnershipType } from '../model/venue';

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
  indoor = false;
  changingRooms = false;
  parking = false;
  lighting = false;
  toilets: boolean | null = null;
  lockers: boolean | null = null;
  accessible: boolean | null = null;
  firstAid: boolean | null = null;
  aed: boolean | null = null;
  cafe: boolean | null = null;
  services = '';
  transport = '';
  openingHours = '';
  priceInfo = '';
  latitude: number | null = null;
  longitude: number | null = null;
  saving = false;
  saveError = false;
  validationError = false;
  locating = false;
  locationError = false;

  constructor(private venueService: VenueService, private router: Router) {}

  useCurrentLocation(): void {
    if (!navigator.geolocation || this.locating) {
      this.locationError = true;
      return;
    }

    this.locating = true;
    this.locationError = false;
    navigator.geolocation.getCurrentPosition(
      position => {
        this.latitude = position.coords.latitude;
        this.longitude = position.coords.longitude;
        this.locating = false;
      },
      () => {
        this.locationError = true;
        this.locating = false;
      }
    );
  }

  save(): void {
    if (this.saving) return;

    if (!this.name.trim() || !this.city.trim() || !this.address.trim()) {
      this.validationError = true;
      return;
    }

    this.validationError = false;

    const request: CreateVenueRequest = {
      name: this.name.trim(), city: this.city.trim(), address: this.address.trim(),
      sports: this.valueOrNull(this.sports), venueType: this.valueOrNull(this.venueType),
      ownershipType: this.ownershipType, surfaceType: this.valueOrNull(this.surfaceType),
      indoor: this.indoor, changingRooms: this.changingRooms, toilets: this.toilets,
      lockers: this.lockers, accessible: this.accessible, firstAid: this.firstAid,
      aed: this.aed, cafe: this.cafe, services: this.valueOrNull(this.services),
      transport: this.valueOrNull(this.transport), openingHours: this.valueOrNull(this.openingHours),
      priceInfo: this.valueOrNull(this.priceInfo), parking: this.parking, lighting: this.lighting,
      latitude: this.latitude, longitude: this.longitude
    };

    this.saving = true;
    this.saveError = false;
    this.venueService.create(request).pipe(finalize(() => this.saving = false)).subscribe({
      next: venue => this.router.navigate(['/menu/venues', venue.id]),
      error: () => this.saveError = true
    });
  }

  private valueOrNull(value: string): string | null {
    const trimmed = value.trim();
    return trimmed || null;
  }
}
