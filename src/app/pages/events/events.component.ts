import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { finalize, retry, Subscription, timeout } from 'rxjs';

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
export class EventsComponent implements OnInit, OnDestroy {
  sessions: SessionSummary[] = [];
  citySuggestions: string[] = [];
  loading = false;
  locating = false;
  errorMessage = '';
  locationError = '';

  readonly sportsCatalog = SPORTS_CATALOG;

  sport = '';
  city = '';
  availableOnly = false;
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

  private searchRequestId = 0;
  private locationRequestId = 0;
  private currentSearch?: Subscription;
  private destroyed = false;

  constructor(
    private sessionService: SessionService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    // Reuse Discover's explicit filters without changing the default Sessions entry.
    const params = this.route.snapshot.queryParamMap;
    this.sport = (params.get('sport') || '').trim();
    this.city = (params.get('city') || '').trim();
    this.loadSessions();
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    ++this.searchRequestId;
    ++this.locationRequestId;
    this.currentSearch?.unsubscribe();
  }

  loadSessions(): void {
    if (this.destroyed) return;
    const requestId = ++this.searchRequestId;
    // Only the most recent filters are allowed to update the screen.
    this.currentSearch?.unsubscribe();
    this.loading = true;
    this.errorMessage = '';

    const from = this.toIsoOrUndefined(this.fromDateTime);
    const to = this.toIsoOrUndefined(this.toDateTime);

    if (from && to && new Date(from).getTime() > new Date(to).getTime()) {
      this.loading = false;
      this.sessions = [];
      this.citySuggestions = [];
      this.errorMessage = t('feedback.events.invalidDateRange');
      return;
    }

    if (
      this.minPrice !== null
      && this.maxPrice !== null
      && this.minPrice > this.maxPrice
    ) {
      this.loading = false;
      this.sessions = [];
      this.citySuggestions = [];
      this.errorMessage = t('feedback.events.invalidPriceRange');
      return;
    }

    this.currentSearch = this.sessionService.discover({
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
    .pipe(
      timeout(10_000),
      retry({ count: 1 }),
      finalize(() => {
        if (requestId === this.searchRequestId && !this.destroyed) {
          this.loading = false;
        }
      })
    )
    .subscribe({
      next: sessions => {
        if (requestId !== this.searchRequestId || this.destroyed) return;
        this.sessions = sessions;
        this.updateCitySuggestions();
      },
      error: () => {
        if (requestId !== this.searchRequestId || this.destroyed) return;
        this.sessions = [];
        this.citySuggestions = [];
        this.errorMessage = t('feedback.events.loadError');
      }
    });
  }

  useCurrentLocation(): void {
    if (this.locating || this.destroyed) return;
    this.locationError = '';

    if (!navigator.geolocation) {
      this.locationError = t('feedback.location.unsupported');
      return;
    }

    this.locating = true;
    const requestId = ++this.locationRequestId;

    navigator.geolocation.getCurrentPosition(
      position => {
        if (requestId !== this.locationRequestId || this.destroyed) return;
        this.latitude = position.coords.latitude;
        this.longitude = position.coords.longitude;
        this.nearbyActive = true;
        this.sort = 'distance';
        this.locating = false;
        this.loadSessions();
      },
      () => {
        if (requestId !== this.locationRequestId || this.destroyed) return;
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
    ++this.locationRequestId;
    this.locating = false;
    this.nearbyActive = false;
    this.latitude = null;
    this.longitude = null;
    this.locationError = '';
    if (this.sort === 'distance') {
      this.sort = 'date';
    }
    this.loadSessions();
  }

  vacancies(session: SessionSummary): number {
    return Math.max(
      0,
      session.maxParticipants - session.participantCount
    );
  }

  canJoin(session: SessionSummary): boolean {
    return !session.privateGame
      && !session.joinedByViewer
      && !session.waitlistedByViewer
      && this.vacancies(session) > 0
      && session.status?.toUpperCase() === 'OPEN'
      && Date.parse(session.gameDate) > Date.now();
  }

  canJoinWaitlist(session: SessionSummary): boolean {
    return !session.privateGame
      && !session.joinedByViewer
      && !session.waitlistedByViewer
      && this.vacancies(session) === 0
      && session.status?.toUpperCase() === 'FULL'
      && Date.parse(session.gameDate) > Date.now();
  }

  toggleAdvancedFilters(): void {
    this.showAdvancedFilters = !this.showAdvancedFilters;
  }

  clearFilters(): void {
    this.sport = '';
    this.city = '';
    this.availableOnly = false;
    this.freeOnly = false;
    this.fromDateTime = '';
    this.toDateTime = '';
    this.minPrice = null;
    this.maxPrice = null;
    this.sort = this.nearbyActive ? 'distance' : 'date';
    this.errorMessage = '';
    this.loadSessions();
  }

  private updateCitySuggestions(): void {
    this.citySuggestions = [...new Set(
      this.sessions
        .map(session => session.city?.trim())
        .filter((city): city is string => Boolean(city))
    )].sort((a, b) => a.localeCompare(b, 'pt'));
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
