import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { finalize } from 'rxjs';

import { SessionSummary } from '../model/session-summary';
import { appTranslate as t } from '../../i18n/i18n.service';
import { SessionService } from '../../services/session.service';
import { SPORTS_CATALOG } from '../../shared/sports-catalog';

@Component({
  selector: 'app-events',
  templateUrl: './events.component.html',
  styleUrls: ['./events.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false
})
export class EventsComponent implements OnInit {
  sessions: SessionSummary[] = [];
  loading = false;
  locating = false;
  errorMessage = '';
  locationError = '';

  readonly sportsCatalog = SPORTS_CATALOG;

  sport = '';
  city = '';
  availableOnly = true;
  freeOnly = false;
  sort = 'date';

  showAdvancedFilters = false;
  fromDateTime = '';
  toDateTime = '';
  minPrice: number | null = null;
  maxPrice: number | null = null;

  nearbyActive = false;
  radiusKm = 25;
  latitude: number | null = null;
  longitude: number | null = null;

  constructor(private sessionService: SessionService) {}

  ngOnInit(): void {
    this.loadSessions();
  }

  loadSessions(): void {
    this.loading = true;
    this.errorMessage = '';

    const from = this.toIsoOrUndefined(this.fromDateTime);
    const to = this.toIsoOrUndefined(this.toDateTime);

    if (from && to && new Date(from).getTime() > new Date(to).getTime()) {
      this.loading = false;
      this.errorMessage = t('feedback.events.invalidDateRange');
      return;
    }

    if (
      this.minPrice !== null
      && this.maxPrice !== null
      && this.minPrice > this.maxPrice
    ) {
      this.loading = false;
      this.errorMessage = t('feedback.events.invalidPriceRange');
      return;
    }

    this.sessionService.discover({
      sport: this.sport,
      city: this.city,
      availability: this.availableOnly ? 'available' : undefined,
      freeOnly: this.freeOnly ? true : undefined,
      sort: this.sort,
      latitude: this.nearbyActive && this.latitude !== null ? this.latitude : undefined,
      longitude: this.nearbyActive && this.longitude !== null ? this.longitude : undefined,
      radiusKm: this.nearbyActive ? this.radiusKm : undefined,
      from,
      to,
      minPrice: this.freeOnly || this.minPrice === null
        ? undefined
        : Math.max(0, Number(this.minPrice)),
      maxPrice: this.freeOnly || this.maxPrice === null
        ? undefined
        : Math.max(0, Number(this.maxPrice))
    })
    .pipe(finalize(() => this.loading = false))
    .subscribe({
      next: sessions => this.sessions = sessions,
      error: () => {
        this.sessions = [];
        this.errorMessage = t('feedback.events.loadError');
      }
    });
  }

  useCurrentLocation(): void {
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
        this.nearbyActive = true;
        this.sort = 'distance';
        this.locating = false;
        this.loadSessions();
      },
      () => {
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

  disableNearby(): void {
    this.nearbyActive = false;
    this.latitude = null;
    this.longitude = null;
    this.locationError = '';
    if (this.sort === 'distance') {
      this.sort = 'date';
    }
    this.loadSessions();
  }

  get citySuggestions(): string[] {
    return [...new Set(
      this.sessions
        .map(session => session.city?.trim())
        .filter((city): city is string => Boolean(city))
    )].sort((a, b) => a.localeCompare(b, 'pt'));
  }

  toggleAdvancedFilters(): void {
    this.showAdvancedFilters = !this.showAdvancedFilters;
  }

  clearFilters(): void {
    this.sport = '';
    this.city = '';
    this.availableOnly = true;
    this.freeOnly = false;
    this.fromDateTime = '';
    this.toDateTime = '';
    this.minPrice = null;
    this.maxPrice = null;
    this.sort = this.nearbyActive ? 'distance' : 'date';
    this.errorMessage = '';
    this.loadSessions();
  }

  private toIsoOrUndefined(value: string): string | undefined {
    if (!value) {
      return undefined;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime())
      ? undefined
      : parsed.toISOString();
  }
}
