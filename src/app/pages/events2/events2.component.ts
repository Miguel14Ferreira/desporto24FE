import { HttpErrorResponse } from '@angular/common/http';
import { appTranslate as t } from '../../i18n/i18n.service';
import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize, retry, timeout } from 'rxjs';

import { CreateSessionRequest } from '../model/create-session-request';
import { SessionService } from '../../services/session.service';
import { CommunityGroupsService } from '../../services/community-groups.service';
import { VenueService } from '../../services/venue.service';
import { Venue, VenueOwnershipType } from '../model/venue';
import { SPORTS_CATALOG } from '../../shared/sports-catalog';

@Component({
  selector: 'app-events2',
  templateUrl: './events2.component.html',
  styleUrls: ['./events2.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false
})
export class Events2Component implements OnInit {
  sport = '';
  gameDate = '';
  city = '';
  address = '';
  maxParticipants = 4;

  privateGame = false;
  password = '';

  hasPrice = false;
  priceAmount: number | null = null;

  photo?: File;
  photoPreview = '';
  minDate = '';

  latitude: number | null = null;
  longitude: number | null = null;
  locating = false;
  locationCaptured = false;
  locationError = '';

  loading = false;
  errorMessage = '';

  communityId: number | null = null;
  communityName = '';

  readonly sportsCatalog = SPORTS_CATALOG;
  venues: Venue[] = [];
  selectedVenueId: number | null = null;
  venuesLoading = false;
  venueSaving = false;
  showVenueCreator = false;
  venueName = '';
  venueType = '';
  venueOwnershipType: VenueOwnershipType | null = null;
  venueSurfaceType = '';
  venueIndoor = false;
  venueChangingRooms = false;
  venueToilets: boolean | null = null;
  venueLockers: boolean | null = null;
  venueAccessible: boolean | null = null;
  venueFirstAid: boolean | null = null;
  venueAed: boolean | null = null;
  venueCafe: boolean | null = null;
  venueServices = '';
  venueTransport = '';
  venueOpeningHours = '';
  venuePriceInfo = '';
  venueParking = false;
  venueLighting = false;

  constructor(
    private sessionService: SessionService,
    private communityService: CommunityGroupsService,
    private venueService: VenueService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.minDate = this.toLocalDateTimeValue(new Date());
    this.loadVenues();

    const communityId = Number(this.route.snapshot.queryParamMap.get('community'));
    if (Number.isFinite(communityId) && communityId > 0) {
      this.communityId = communityId;
      this.communityService.get(communityId).subscribe({
        next: community => {
          this.communityName = community.name;
          if (!this.sport.trim() && community.sport) {
            this.sport = community.sport;
          }
        },
        error: () => {
          this.communityId = null;
          this.communityName = '';
        }
      });
    }
  }

  createSession(): void {
    const validationError = this.validate();
    if (validationError) {
      this.errorMessage = validationError;
      return;
    }

    const request: CreateSessionRequest = {
      sport: this.sport.trim(),
      gameDate: new Date(this.gameDate).toISOString(),
      city: this.city.trim(),
      address: this.address.trim(),
      maxParticipants: Number(this.maxParticipants),
      priceAmount: this.hasPrice ? Number(this.priceAmount ?? 0) : 0,
      privateGame: this.privateGame,
      password: this.privateGame ? this.password.trim() : null,
      latitude: this.locationCaptured ? this.latitude : null,
      longitude: this.locationCaptured ? this.longitude : null,
      communityId: this.communityId,
      venueId: this.selectedVenueId
    };

    this.loading = true;
    this.errorMessage = '';

    this.sessionService.create(request, this.photo)
      .pipe(
        timeout(10_000),
        finalize(() => this.loading = false)
      )
      .subscribe({
        next: session => this.router.navigate(['/menu/events', session.id]),
        error: error => {
          this.errorMessage = this.errorFrom(
            error,
            t('feedback.create.error')
          );
        }
      });
  }

  loadVenues(): void {
    this.venuesLoading = true;

    this.venueService.search()
      .pipe(
        timeout(10_000),
        retry({ count: 1 }),
        finalize(() => this.venuesLoading = false)
      )
      .subscribe({
        next: venues => this.venues = venues,
        error: () => this.venues = []
      });
  }

  get venueOptions(): Venue[] {
    const city = this.city.trim().toLocaleLowerCase('pt');
    const sport = this.sport.trim().toLocaleLowerCase('pt');

    return this.venues.filter(venue => {
      const cityMatches = !city
        || venue.city.toLocaleLowerCase('pt').includes(city);

      const venueSports = (venue.sports || '').toLocaleLowerCase('pt');
      const sportMatches = !sport
        || !venueSports
        || venueSports.includes(sport);

      return cityMatches && sportMatches;
    });
  }

  selectVenue(value: number | string | null): void {
    const venueId = value === null || value === ''
      ? null
      : Number(value);

    this.selectedVenueId = venueId !== null && Number.isFinite(venueId)
      ? venueId
      : null;

    if (this.selectedVenueId === null) {
      return;
    }

    const venue = this.venues.find(item => item.id === this.selectedVenueId);
    if (!venue) {
      return;
    }

    this.city = venue.city;
    this.address = venue.address;

    if (!this.sport.trim() && venue.sports) {
      this.sport = venue.sports.split(',')[0]?.trim() || '';
    }

    if (venue.latitude !== null && venue.longitude !== null) {
      this.latitude = venue.latitude;
      this.longitude = venue.longitude;
      this.locationCaptured = true;
    } else {
      this.clearLocation();
    }
  }

  toggleVenueCreator(): void {
    this.showVenueCreator = !this.showVenueCreator;
    this.errorMessage = '';
  }

  saveVenue(): void {
    if (this.venueSaving) {
      return;
    }

    if (!this.venueName.trim() || !this.city.trim() || !this.address.trim()) {
      this.errorMessage = t('feedback.venue.required');
      return;
    }

    this.venueSaving = true;
    this.errorMessage = '';

    this.venueService.create({
      name: this.venueName.trim(),
      city: this.city.trim(),
      address: this.address.trim(),
      sports: this.sport.trim() || null,
      venueType: this.venueType.trim() || null,
      ownershipType: this.venueOwnershipType,
      surfaceType: this.venueSurfaceType.trim() || null,
      indoor: this.venueIndoor,
      changingRooms: this.venueChangingRooms,
      toilets: this.venueToilets,
      lockers: this.venueLockers,
      accessible: this.venueAccessible,
      firstAid: this.venueFirstAid,
      aed: this.venueAed,
      cafe: this.venueCafe,
      services: this.venueServices.trim() || null,
      transport: this.venueTransport.trim() || null,
      openingHours: this.venueOpeningHours.trim() || null,
      priceInfo: this.venuePriceInfo.trim() || null,
      parking: this.venueParking,
      lighting: this.venueLighting,
      latitude: this.locationCaptured ? this.latitude : null,
      longitude: this.locationCaptured ? this.longitude : null
    })
      .pipe(finalize(() => this.venueSaving = false))
      .subscribe({
        next: venue => {
          this.venues = [...this.venues, venue]
            .sort((a, b) => a.name.localeCompare(b.name, 'pt'));
          this.selectedVenueId = venue.id;
          this.showVenueCreator = false;
          this.venueName = '';
          this.venueType = '';
          this.venueOwnershipType = null;
          this.venueSurfaceType = '';
          this.venueIndoor = false;
          this.venueChangingRooms = false;
          this.venueToilets = null;
          this.venueLockers = null;
          this.venueAccessible = null;
          this.venueFirstAid = null;
          this.venueAed = null;
          this.venueCafe = null;
          this.venueServices = '';
          this.venueTransport = '';
          this.venueOpeningHours = '';
          this.venuePriceInfo = '';
          this.venueParking = false;
          this.venueLighting = false;
        },
        error: error => {
          this.errorMessage = this.errorFrom(
            error,
            t('feedback.venue.createError')
          );
        }
      });
  }

  selectedVenue(): Venue | undefined {
    return this.venues.find(venue => venue.id === this.selectedVenueId);
  }

  captureCurrentLocation(): void {
    this.locationError = '';

    if (!navigator.geolocation) {
      this.locationError = t('feedback.location.unsupported');
      return;
    }

    this.locating = true;

    navigator.geolocation.getCurrentPosition(
      position => {
        this.latitude = position.coords.latitude;
        this.longitude = position.coords.longitude;
        this.locationCaptured = true;
        this.locating = false;
      },
      () => {
        this.locationCaptured = false;
        this.latitude = null;
        this.longitude = null;
        this.locating = false;
        this.locationError = t('feedback.location.error');
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 300000
      }
    );
  }

  clearLocation(): void {
    this.locationCaptured = false;
    this.latitude = null;
    this.longitude = null;
    this.locationError = '';
  }

  onPhotoChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      this.photo = undefined;
      this.photoPreview = '';
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.errorMessage = t('feedback.image.choose');
      input.value = '';
      return;
    }

    this.photo = file;
    this.errorMessage = '';

    const reader = new FileReader();
    reader.onload = () => {
      this.photoPreview = typeof reader.result === 'string' ? reader.result : '';
    };
    reader.readAsDataURL(file);
  }

  clearPhoto(): void {
    this.photo = undefined;
    this.photoPreview = '';
  }

  private validate(): string | null {
    if (!this.sport.trim() || !this.gameDate || !this.city.trim() || !this.address.trim()) {
      return 'Preenche o desporto, data, localidade e morada.';
    }

    const gameInstant = new Date(this.gameDate);
    if (Number.isNaN(gameInstant.getTime()) || gameInstant.getTime() <= Date.now()) {
      return t('feedback.create.futureDate');
    }

    const players = Number(this.maxParticipants);
    if (!Number.isInteger(players) || players < 2 || players > 100) {
      return t('feedback.create.playersRange');
    }

    if (this.privateGame && !this.password.trim()) {
      return t('feedback.create.privatePassword');
    }

    if (this.hasPrice) {
      const price = Number(this.priceAmount);
      if (!Number.isFinite(price) || price < 0) {
        return t('feedback.create.negativePrice');
      }
    }

    return null;
  }

  private errorFrom(error: HttpErrorResponse, fallback: string): string {
    const apiMessage = error.error?.message;
    return typeof apiMessage === 'string' && apiMessage.trim()
      ? apiMessage
      : fallback;
  }

  private toLocalDateTimeValue(date: Date): string {
    const pad = (value: number) => String(value).padStart(2, '0');
    return [
      date.getFullYear(),
      '-',
      pad(date.getMonth() + 1),
      '-',
      pad(date.getDate()),
      'T',
      pad(date.getHours()),
      ':',
      pad(date.getMinutes())
    ].join('');
  }
}
