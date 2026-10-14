import { HttpErrorResponse } from '@angular/common/http';
import { appTranslate as t } from '../../i18n/i18n.service';
import { ChangeDetectionStrategy, Component, NgZone, OnInit } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize, retry, timeout } from 'rxjs';

import { CreateSessionRequest } from '../model/create-session-request';
import { SessionService } from '../../services/session.service';
import { CommunityGroupsService } from '../../services/community-groups.service';
import { VenuePhoto, VenueService } from '../../services/venue.service';
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
  // The organiser already has one reserved Jynlo place.
  confirmedPlayers: number | null = 1;

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
  locationSource: 'gps' | 'map' | null = null;
  gpsAccuracyMeters: number | null = null;
  private gpsRequestId = 0;

  get gpsAccuracyIsLow(): boolean {
    return this.gpsAccuracyMeters !== null && this.gpsAccuracyMeters > 100;
  }

  get hasCoordinates(): boolean {
    return this.locationCaptured
      && this.latitude !== null && this.longitude !== null
      && Number.isFinite(this.latitude) && Number.isFinite(this.longitude)
      && Math.abs(this.latitude) <= 90 && Math.abs(this.longitude) <= 180;
  }

  loading = false;
  errorMessage = '';

  communityId: number | null = null;
  communityName = '';
  recurrence: 'NONE' | 'WEEKLY' | 'BIWEEKLY' = 'NONE';
  recurrenceOccurrences = 4;

  readonly sportsCatalog = SPORTS_CATALOG;
  venues: Venue[] = [];
  venueSearch = '';
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
  selectedVenuePhoto: VenuePhoto | null = null;
  venuePhotoLoading = false;
  private venuePhotoRequestId = 0;
  selectedVenueMapUrl: SafeResourceUrl | null = null;
  venueMapLink = '';
  venueMapLinkLoading = false;
  private venueMapRequestId = 0;
  venueMapLinkError = '';
  venueMapCandidateResolvedUrl = '';

  constructor(
    private sessionService: SessionService,
    private communityService: CommunityGroupsService,
    private venueService: VenueService,
    private sanitizer: DomSanitizer,
    private route: ActivatedRoute,
    private router: Router,
    private ngZone: NgZone
  ) {}

  get findPlayersMode(): boolean {
    return this.route.snapshot.queryParamMap.get('intent') === 'findPlayers' && !this.communityId;
  }

  get availablePlaces(): number {
    const maximum = Number(this.maxParticipants);
    const confirmed = Number(this.confirmedPlayers);
    if (!Number.isInteger(maximum) || !Number.isInteger(confirmed)
        || maximum < 2 || maximum > 100 || confirmed < 1 || confirmed > maximum) {
      return 0;
    }
    return maximum - confirmed;
  }

  ngOnInit(): void {
    this.minDate = this.toLocalDateTimeValue(new Date());
    this.loadVenues();

    const communityId = Number(this.route.snapshot.queryParamMap.get('community'));
    if (Number.isFinite(communityId) && communityId > 0) {
      this.communityId = communityId;
      this.communityService.get(communityId)
        .pipe(
          timeout(10_000),
          retry({ count: 1 })
        )
        .subscribe({
        next: community => {
          this.communityName = community.name;
          if (!this.sport.trim() && community.sport) {
            this.sport = community.sport;
          }
        },
        error: () => {
          this.errorMessage = t('feedback.communities.openError');
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
      address: this.address.trim() || (this.hasCoordinates
        ? t('createSession.mapPointAddress', {
            latitude: this.latitude!.toFixed(6),
            longitude: this.longitude!.toFixed(6)
          })
        : ''),
      maxParticipants: Number(this.maxParticipants),
      ...(this.findPlayersMode
        ? { externalConfirmedParticipants: Number(this.confirmedPlayers) - 1 }
        : {}),
      priceAmount: this.hasPrice ? Number(this.priceAmount ?? 0) : 0,
      privateGame: this.findPlayersMode ? false : this.privateGame,
      password: this.findPlayersMode ? null : (this.privateGame ? this.password.trim() : null),
      latitude: this.hasCoordinates ? this.latitude : null,
      longitude: this.hasCoordinates ? this.longitude : null,
      communityId: this.communityId,
      venueId: this.selectedVenueId,
      recurrence: this.communityId ? this.recurrence : 'NONE',
      recurrenceOccurrences: this.communityId && this.recurrence !== 'NONE'
        ? Number(this.recurrenceOccurrences)
        : null
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

  get sportSelected(): boolean {
    return this.sportsCatalog.some(
      option => option.toLocaleLowerCase('pt') === this.sport.trim().toLocaleLowerCase('pt')
    );
  }

  get venueOptions(): Venue[] {
    const city = this.city.trim().toLocaleLowerCase('pt');
    const sport = this.sport.trim().toLocaleLowerCase('pt');
    const search = this.venueSearch.trim().toLocaleLowerCase('pt');

    const filtered = this.venues.filter(venue => {
      const cityMatches = !city
        || venue.city.toLocaleLowerCase('pt').includes(city);

      const venueSports = (venue.sports || '').toLocaleLowerCase('pt');
      const sportMatches = !sport
        || !venueSports
        || venueSports.split(/[;,]/).some(venueSport => venueSport.trim() === sport);

      const acronym = venue.name
        .split(/\s+/)
        .filter(part => part.length > 2)
        .map(part => part[0])
        .join('')
        .toLocaleLowerCase('pt');

      const searchable = [
        venue.name,
        venue.city,
        venue.name + ' · ' + venue.city,
        venue.address,
        venue.venueType || '',
        acronym
      ].join(' ').toLocaleLowerCase('pt');

      const searchMatches = !search || searchable.includes(search);

      return cityMatches && sportMatches && searchMatches;
    });

    return search ? filtered.slice(0, 40) : filtered.slice(0, 40);
  }

  confirmSportSelection(): void {
    const selected = this.sportsCatalog.find(
      option => option.toLocaleLowerCase('pt') === this.sport.trim().toLocaleLowerCase('pt')
    );

    if (!selected) {
      this.sport = '';
      this.venueSearch = '';
      this.selectVenue(null);
      return;
    }

    this.sport = selected;
    this.venueSearch = '';
    this.selectVenue(null);
  }

  onVenueSearchChanged(value: string): void {
    if (this.venueSearch === value) {
      return;
    }

    this.venueSearch = value;
    if (this.selectedVenueId !== null) {
      // Stop filtering suggestions by the city inherited from the old venue.
      this.selectVenue(null);
    }
  }

  confirmVenueSelection(): void {
    const normalized = this.venueSearch.trim().toLocaleLowerCase('pt');
    // Only allow venues compatible with the current sport, city and search.
    const match = this.sportSelected
      ? this.venueOptions.find(
          venue =>
            venue.name.toLocaleLowerCase('pt') === normalized
            || (venue.name + ' · ' + venue.city).toLocaleLowerCase('pt') === normalized
        )
      : undefined;

    if (!match) {
      this.selectVenue(null);
      return;
    }

    this.venueSearch = match.name + ' · ' + match.city;
    this.selectVenue(match.id);
  }

  selectVenue(value: number | string | null): void {
    this.invalidateVenueMapLinkRequest();
    // Changing venues also cancels an unfinished browser GPS request.
    this.gpsRequestId++;
    this.locating = false;
    // Invalidate outstanding photo requests before changing the selected venue.
    this.venuePhotoRequestId++;
    const previousVenue = this.venues.find(venue => venue.id === this.selectedVenueId);
    const venueId = value === null || value === ''
      ? null
      : Number(value);

    this.selectedVenueId = venueId !== null && Number.isFinite(venueId)
      ? venueId
      : null;

    if (this.selectedVenueId === null) {
      this.selectedVenuePhoto = null;
      this.venuePhotoLoading = false;
      this.selectedVenueMapUrl = null;

      if (previousVenue) {
        // Do not silently reuse a deselected venue's location for another sport.
        if (this.city === previousVenue.city) {
          this.city = '';
        }
        if (this.address === previousVenue.address) {
          this.address = '';
        }
        this.clearLocation();
      }
      return;
    }

    const venue = this.venues.find(item => item.id === this.selectedVenueId);
    if (!venue) {
      this.selectedVenuePhoto = null;
      this.selectedVenueMapUrl = null;
      return;
    }

    this.locationSource = null;
    this.gpsAccuracyMeters = null;
    this.venueMapCandidateResolvedUrl = '';
    this.venueMapLink = '';
    this.loadVenuePhoto(venue.id);
    this.selectedVenueMapUrl = venue.latitude !== null && venue.longitude !== null
      ? this.sanitizer.bypassSecurityTrustResourceUrl(
          'https://www.google.com/maps?q='
          + venue.latitude + ',' + venue.longitude
          + '&z=16&output=embed'
        )
      : null;

    this.city = venue.city;
    this.address = venue.address;

    if (!this.sport.trim() && venue.sports) {
      this.sport = venue.sports.split(/[;,]/)[0]?.trim() || '';
    }

    if (venue.latitude !== null && venue.longitude !== null) {
      this.latitude = venue.latitude;
      this.longitude = venue.longitude;
      this.locationCaptured = true;
    } else {
      this.clearLocation();
    }
  }

  private loadVenuePhoto(venueId: number): void {
    const requestId = this.venuePhotoRequestId;
    const isCurrentVenue = () =>
      requestId === this.venuePhotoRequestId && this.selectedVenueId === venueId;

    this.selectedVenuePhoto = null;
    this.venuePhotoLoading = true;

    this.venueService.listPhotos(venueId)
      .pipe(
        timeout(10_000),
        finalize(() => {
          if (isCurrentVenue()) {
            this.venuePhotoLoading = false;
          }
        })
      )
      .subscribe({
        next: photos => {
          if (isCurrentVenue()) {
            this.selectedVenuePhoto = photos[0] ?? null;
          }
        },
        error: () => {
          if (isCurrentVenue()) {
            this.selectedVenuePhoto = null;
          }
        }
      });
  }

  useMapLinkVenue(): void {
    this.invalidateVenueMapLinkRequest();
    this.venuePhotoRequestId++;
    this.selectedVenueId = null;
    this.selectedVenuePhoto = null;
    this.venuePhotoLoading = false;
    this.selectedVenueMapUrl = null;
    this.city = '';
    this.address = '';
    this.clearLocation();
  }

  onVenueMapLinkChanged(url: string): void {
    if (this.venueMapLink === url) {
      return;
    }

    this.venueMapLink = url;
    this.venueMapLinkError = '';
    this.invalidateVenueMapLinkRequest();
    // Choosing a Maps link invalidates any pending browser GPS callback.
    this.gpsRequestId++;
    this.locating = false;

    // A previously confirmed link must not leave its old map coordinates behind.
    if (this.locationSource === 'map') {
      this.clearLocation();
    }
  }

  resolveVenueMapLink(): void {
    const url = this.venueMapLink.trim();
    if (!url || this.venueMapLinkLoading) {
      return;
    }

    // Revalidating a link invalidates the previous Maps point, even if the
    // field was changed programmatically rather than through the template.
    if (this.locationSource === 'map') {
      this.clearLocation();
    }

    this.gpsRequestId++;
    this.locating = false;
    const requestId = ++this.venueMapRequestId;
    const isCurrentRequest = () =>
      requestId === this.venueMapRequestId
      && this.selectedVenueId === null
      && this.venueMapLink.trim() === url;
    this.venueMapLinkLoading = true;
    this.venueMapLinkError = '';
    this.venueMapCandidateResolvedUrl = '';

    this.venueService.resolveMapLink(url)
      .pipe(
        timeout(12_000),
        finalize(() => {
          if (requestId === this.venueMapRequestId) {
            this.venueMapLinkLoading = false;
          }
        })
      )
      .subscribe({
        next: candidate => {
          // A removed or superseded Maps lookup must never restore old coordinates.
          if (!isCurrentRequest()) {
            return;
          }
          this.latitude = candidate.latitude;
          this.longitude = candidate.longitude;
          this.locationCaptured = true;
          this.locationSource = 'map';
          this.gpsAccuracyMeters = null;
          this.locationError = '';
          this.venueMapCandidateResolvedUrl = candidate.resolvedUrl;
          this.selectedVenueMapUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
            'https://www.google.com/maps?q='
            + candidate.latitude + ',' + candidate.longitude
            + '&z=16&output=embed'
          );
        },
        error: () => {
          if (isCurrentRequest()) {
            this.venueMapLinkError = t('venue.mapLink.error');
            this.venueMapCandidateResolvedUrl = '';
          }
        }
      });
  }

  private invalidateVenueMapLinkRequest(): void {
    this.venueMapRequestId++;
    this.venueMapLinkLoading = false;
  }

  clearVenueMapLinkCandidate(): void {
    this.venueMapCandidateResolvedUrl = '';
    this.selectedVenueMapUrl = null;
    this.venueMapLinkError = '';
    this.clearLocation();
  }

  toggleVenueCreator(): void {
    this.showVenueCreator = !this.showVenueCreator;
    this.errorMessage = '';
  }

  saveVenue(): void {
    if (this.venueSaving) {
      return;
    }

    if (!this.sportSelected) {
      this.errorMessage = t('venue.create.sportsRequired');
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
      sports: this.sport.trim(),
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
      .pipe(
        timeout(10_000),
        finalize(() => this.venueSaving = false)
      )
      .subscribe({
        next: venue => {
          this.venues = [...this.venues, venue]
            .sort((a, b) => a.name.localeCompare(b.name, 'pt'));
          // Newly saved venues must go through the same selection flow as existing ones.
          this.selectVenue(venue.id);
          this.venueSearch = venue.name + ' · ' + venue.city;
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
    if (this.locating || this.loading || this.selectedVenueId !== null) {
      return;
    }

    this.locationError = '';
    if (!navigator.geolocation) {
      this.locationError = t('feedback.location.unsupported');
      return;
    }

    this.invalidateVenueMapLinkRequest();
    const requestId = ++this.gpsRequestId;
    this.locating = true;
    navigator.geolocation.getCurrentPosition(
      position => this.ngZone.run(() => {
        if (requestId !== this.gpsRequestId) {
          return;
        }
        this.applyCurrentPosition(
          position.coords.latitude, position.coords.longitude, position.coords.accuracy);
      }),
      () => this.ngZone.run(() => {
        if (requestId !== this.gpsRequestId) {
          return;
        }
        this.locating = false;
        this.locationError = t('feedback.location.error');
      }),
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0
      }
    );
  }

  applyCurrentPosition(latitude: number, longitude: number, accuracyMeters?: number): void {
    // A location chosen directly supersedes an older browser request too.
    this.gpsRequestId++;
    if (this.selectedVenueId !== null || !Number.isFinite(latitude)
        || !Number.isFinite(longitude) || Math.abs(latitude) > 90
        || Math.abs(longitude) > 180) {
      this.locating = false;
      this.locationError = t('feedback.location.error');
      return;
    }

    this.invalidateVenueMapLinkRequest();
    this.latitude = latitude;
    this.longitude = longitude;
    this.locationCaptured = true;
    this.locationSource = 'gps';
    this.gpsAccuracyMeters = accuracyMeters !== undefined
      && Number.isFinite(accuracyMeters) && accuracyMeters >= 0
        ? Math.max(1, Math.round(accuracyMeters))
        : null;
    this.locating = false;
    this.locationError = '';
    this.venueMapLink = '';
    this.venueMapLinkError = '';
    this.venueMapCandidateResolvedUrl = '';
    this.selectedVenueMapUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
      'https://www.google.com/maps?q=' + latitude + ',' + longitude + '&z=17&output=embed'
    );
  }

  clearLocation(): void {
    this.invalidateVenueMapLinkRequest();
    this.gpsRequestId++;
    this.locating = false;
    this.locationCaptured = false;
    this.latitude = null;
    this.longitude = null;
    this.locationSource = null;
    this.gpsAccuracyMeters = null;
    this.locationError = '';
    if (this.selectedVenueId === null) {
      this.selectedVenueMapUrl = null;
      this.venueMapCandidateResolvedUrl = '';
      this.venueMapLinkError = '';
    }
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
    if (!this.sportSelected) {
      return 'Seleciona um desporto da lista.';
    }

    if (this.selectedVenueId !== null) {
      const venue = this.venues.find(item => item.id === this.selectedVenueId);
      if (!venue) {
        return t('createSession.venueNoLongerAvailable');
      }

      // Match the server's semicolon-separated sport check before submitting.
      const venueSports = venue.sports?.trim() || '';
      if (venueSports && !venueSports.split(';').some(
        venueSport => venueSport.trim().toLocaleLowerCase('pt')
          === this.sport.trim().toLocaleLowerCase('pt')
      )) {
        return t('createSession.venueSportMismatch');
      }
    }

    if (!this.gameDate || !this.city.trim()
        || (!this.address.trim() && !this.hasCoordinates)) {
      return 'Preenche a data e a localidade. Sem localização no mapa, indica também a morada.';
    }

    const city = this.city.trim();
    if (!/^[\p{L}\p{M}][\p{L}\p{M}\d .,'’()/-]{1,119}$/u.test(city)) {
      return t('feedback.create.invalidCity');
    }

    const gameInstant = new Date(this.gameDate);
    if (Number.isNaN(gameInstant.getTime()) || gameInstant.getTime() <= Date.now()) {
      return t('feedback.create.futureDate');
    }

    const players = Number(this.maxParticipants);
    if (!Number.isInteger(players) || players < 2 || players > 100) {
      return t('feedback.create.playersRange');
    }

    if (this.findPlayersMode) {
      const confirmed = Number(this.confirmedPlayers);
      if (this.confirmedPlayers === null || !Number.isInteger(confirmed)
          || confirmed < 1 || confirmed > players) {
        return t('createSession.confirmedPlayersError');
      }
    }

    if (this.communityId && this.recurrence !== 'NONE') {
      const occurrences = Number(this.recurrenceOccurrences);
      if (!Number.isInteger(occurrences) || occurrences < 2 || occurrences > 52) {
        return t('feedback.create.recurrenceOccurrencesRange');
      }
    }

    if (!this.findPlayersMode && this.privateGame && !this.password.trim()) {
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
