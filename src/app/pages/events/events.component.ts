import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { finalize } from 'rxjs';

import { SessionSummary } from '../model/session-summary';
import { appTranslate as t } from '../../i18n/i18n.service';
import { SessionService } from '../../services/session.service';

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

  sport = '';
  city = '';
  availableOnly = true;
  freeOnly = false;
  sort = 'date';

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

    this.sessionService.discover({
      sport: this.sport,
      city: this.city,
      availability: this.availableOnly ? 'available' : undefined,
      freeOnly: this.freeOnly ? true : undefined,
      sort: this.sort,
      latitude: this.nearbyActive && this.latitude !== null ? this.latitude : undefined,
      longitude: this.nearbyActive && this.longitude !== null ? this.longitude : undefined,
      radiusKm: this.nearbyActive ? this.radiusKm : undefined
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

  clearFilters(): void {
    this.sport = '';
    this.city = '';
    this.availableOnly = true;
    this.freeOnly = false;
    this.sort = this.nearbyActive ? 'distance' : 'date';
    this.loadSessions();
  }
}
