import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { finalize, retry, timeout } from 'rxjs';

import { VenuePhoto, VenueRatingSummary, VenueService, VenueSportCondition } from '../../services/venue.service';
import { Venue } from '../model/venue';
import { isVenueGpsOnly, venuePostalAddress } from '../../shared/venue-location';
import { venueEnvironmentTranslationKey } from '../../shared/venue-environment';

@Component({
  selector: 'app-venue-details',
  templateUrl: './venue-details.component.html',
  styleUrls: ['./venue-details.component.css'],
  standalone: false
})
export class VenueDetailsComponent implements OnInit {
  readonly venueEnvironmentTranslationKey = venueEnvironmentTranslationKey;
  venue: Venue | null = null;
  photos: VenuePhoto[] = [];
  sportConditions: VenueSportCondition[] = [];
  ratingSummary: VenueRatingSummary | null = null;
  ratingSummaryLoading = true;
  ratingSummaryLoadError = false;
  sportConditionSport = '';
  sportConditionText = '';
  loading = true;
  photosLoading = true;
  sportConditionsLoading = true;
  photoUploading = false;
  photoUploadError = false;
  photosLoadError = false;
  sportConditionsLoadError = false;
  sportConditionSaving = false;
  sportConditionSaveError = false;
  loadError = false;
  private venueLoadVersion = 0;
  private photosLoadVersion = 0;
  private sportConditionsLoadVersion = 0;

  constructor(
    private route: ActivatedRoute,
    private venueService: VenueService
  ) {}

  ngOnInit(): void {
    const venueId = Number(this.route.snapshot.paramMap.get('id'));

    if (!Number.isFinite(venueId) || venueId <= 0) {
      this.loading = false;
      this.photosLoading = false;
      this.sportConditionsLoading = false;
      this.ratingSummaryLoading = false;
      this.loadError = true;
      return;
    }

    this.retryVenue();
    this.loadPhotos(venueId);

    this.loadSportConditions(venueId);
    this.loadRatingSummary(venueId);
  }

  retryVenue(): void {
    const venueId = Number(this.route.snapshot.paramMap.get('id'));
    if (!Number.isSafeInteger(venueId) || venueId <= 0) {
      this.venue = null;
      this.loading = false;
      this.loadError = true;
      return;
    }
    const version = ++this.venueLoadVersion;
    this.loading = true;
    this.loadError = false;
    this.venue = null;
    // Do not make a person watch two successive 10-second timeouts.
    // If the API is unreachable, show a clear retry action.
    this.venueService.get(venueId)
      .pipe(timeout({ first: 12000 }))
      .subscribe({
        next: venue => {
          if (version !== this.venueLoadVersion) return;
          this.venue = venue;
          this.loading = false;
        },
        error: () => {
          if (version !== this.venueLoadVersion) return;
          this.loadError = true;
          this.loading = false;
        }
      });
  }

  private loadRatingSummary(venueId: number): void {
    this.ratingSummaryLoading = true;
    this.ratingSummaryLoadError = false;
    this.venueService.getRatingSummary(venueId)
      .pipe(timeout(10_000), finalize(() => this.ratingSummaryLoading = false))
      .subscribe({
        next: summary => {
          if (summary.venueId === venueId && summary.ratingCount >= 3
              && summary.averageScore !== null) {
            this.ratingSummary = summary;
          } else {
            // The backend deliberately hides aggregates under three reviewers.
            this.ratingSummary = null;
          }
        },
        error: () => {
          // A ratings API outage must never break the venue page.
          this.ratingSummary = null;
          this.ratingSummaryLoadError = true;
        }
      });
  }

  get hasConfirmedMapCoordinates(): boolean {
    const latitude = this.venue?.latitude;
    const longitude = this.venue?.longitude;
    return latitude !== null && latitude !== undefined
      && longitude !== null && longitude !== undefined
      && Number.isFinite(latitude) && Number.isFinite(longitude)
      && latitude >= -90 && latitude <= 90
      && longitude >= -180 && longitude <= 180;
  }

  /** Hide OSM coordinate placeholders instead of calling them postal addresses. */
  get postalAddress(): string | null {
    return this.venue ? venuePostalAddress(this.venue) : null;
  }

  get isGpsOnly(): boolean {
    return this.venue ? isVenueGpsOnly(this.venue) : false;
  }

  /** Only show an explicit HTTPS venue website, never user-provided script URLs. */
  get venueWebsiteUrl(): string | null {
    const value = this.venue?.website?.trim();
    if (!value) return null;
    try {
      const parsed = new URL(value);
      if (parsed.protocol !== 'https:' || !parsed.hostname
          || parsed.username || parsed.password
          || parsed.port && parsed.port !== '443') return null;
      return parsed.href;
    } catch {
      return null;
    }
  }

  get mapUrl(): string | null {
    const venue = this.venue;
    if (!venue) return null;

    if (this.hasConfirmedMapCoordinates) {
      return `https://www.google.com/maps?q=${venue.latitude},${venue.longitude}`;
    }

    // A search link is useful but never claims to pinpoint a venue without GPS.
    const query = [venue.name, this.postalAddress, venue.city, venue.district, 'Portugal']
      .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
      .join(', ');
    return query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : null;
  }

  retryPhotos(): void {
    if (!this.venue) return;
    this.loadPhotos(this.venue.id);
  }

  retrySportConditions(): void {
    if (!this.venue) return;
    this.loadSportConditions(this.venue.id);
  }

  addSportCondition(): void {
    const sport = this.sportConditionSport.trim();
    const conditions = this.sportConditionText.trim();

    if (!this.venue || this.sportConditionSaving || !sport || !conditions) {
      this.sportConditionSaveError = true;
      return;
    }

    this.sportConditionSaving = true;
    this.sportConditionSaveError = false;

    this.venueService.addSportCondition(this.venue.id, { sport, conditions })
      .pipe(
        timeout(10_000),
        finalize(() => this.sportConditionSaving = false)
      )
      .subscribe({
        next: condition => {
          // An earlier GET must not wipe the newly saved condition.
          ++this.sportConditionsLoadVersion;
          this.sportConditionsLoading = false;
          this.sportConditionsLoadError = false;
          this.sportConditions = [condition, ...this.sportConditions.filter(item => item.id !== condition.id)];
          this.sportConditionSport = '';
          this.sportConditionText = '';
        },
        error: () => this.sportConditionSaveError = true
      });
  }

  private loadSportConditions(venueId: number): void {
    const version = ++this.sportConditionsLoadVersion;
    this.sportConditionsLoading = true;
    this.sportConditionsLoadError = false;

    this.venueService.listSportConditions(venueId)
      .pipe(
        timeout(10_000),
        retry({ count: 1 }),
        finalize(() => {
          if (version === this.sportConditionsLoadVersion) this.sportConditionsLoading = false;
        })
      )
      .subscribe({
        next: conditions => {
          if (version !== this.sportConditionsLoadVersion) return;
          this.sportConditions = conditions;
        },
        error: () => {
          if (version !== this.sportConditionsLoadVersion) return;
          this.sportConditions = [];
          this.sportConditionsLoadError = true;
        }
      });
  }

  private loadPhotos(venueId: number): void {
    const version = ++this.photosLoadVersion;
    this.photosLoading = true;
    this.photosLoadError = false;

    this.venueService.listPhotos(venueId)
      .pipe(
        timeout(10_000),
        retry({ count: 1 }),
        finalize(() => {
          if (version === this.photosLoadVersion) this.photosLoading = false;
        })
      )
      .subscribe({
        next: photos => {
          if (version !== this.photosLoadVersion) return;
          this.photos = photos;
        },
        error: () => {
          if (version !== this.photosLoadVersion) return;
          this.photos = [];
          this.photosLoadError = true;
        }
      });
  }

  uploadPhoto(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file || !this.venue || this.photoUploading) {
      input.value = '';
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.photoUploadError = true;
      input.value = '';
      return;
    }

    this.photoUploading = true;
    this.photoUploadError = false;

    this.venueService.addPhoto(this.venue.id, file)
      .pipe(
        timeout(10_000),
        finalize(() => this.photoUploading = false)
      )
      .subscribe({
        next: photo => {
          // Preserve the new photo even if an older initial listing finishes later.
          ++this.photosLoadVersion;
          this.photosLoading = false;
          this.photosLoadError = false;
          this.photos = [photo, ...this.photos.filter(item => item.id !== photo.id)];
          input.value = '';
        },
        error: () => {
          this.photoUploadError = true;
          input.value = '';
        }
      });
  }
}
