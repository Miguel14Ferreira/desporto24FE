import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { Observable, catchError, finalize, forkJoin, of, retry, timeout } from 'rxjs';

import { AuthenticationService } from '../../services/authethication.service';
import { CommunityService } from '../../services/community.service';
import { SessionService } from '../../services/session.service';
import { VenueService } from '../../services/venue.service';
import { SPORTS_CATALOG } from '../../shared/sports-catalog';
import { CommunityProfile } from '../model/community-profile';
import { SessionSummary } from '../model/session-summary';
import { Venue } from '../model/venue';

@Component({
  selector: 'app-discover',
  templateUrl: './discover.component.html',
  styleUrls: ['./discover.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false
})
export class DiscoverComponent implements OnInit {
  readonly sportsCatalog = SPORTS_CATALOG;

  sport = '';
  location = '';
  private sportEdited = false;
  private locationEdited = false;
  venues: Venue[] = [];
  topVenueResults: Venue[] = [];
  sessions: SessionSummary[] = [];
  topSessionResults: SessionSummary[] = [];
  people: CommunityProfile[] = [];
  topPeopleResults: CommunityProfile[] = [];

  locatingSessions = false;
  nearbySessionError = '';
  nearbyRadiusKm = 25;
  nearbyPosition: { latitude: number; longitude: number } | null = null;
  private nearbyRequestId = 0;

  loading = false;
  initialized = false;
  loadError = false;
  showAllVenues = false;

  constructor(
    private authenticationService: AuthenticationService,
    private venueService: VenueService,
    private sessionService: SessionService,
    private communityService: CommunityService
  ) {}

  ngOnInit(): void {
    this.authenticationService.isLoggedIn();
    const username = this.authenticationService.loggedInPerfilname;

    if (!username) {
      this.search();
      return;
    }

    this.communityService.publicProfile(username)
      .pipe(
        timeout(10_000),
        retry({ count: 1 }),
        catchError(() => of(null))
      )
      .subscribe(profile => {
        if (profile) {
          if (!this.sportEdited) {
            const favorites = (profile.favoriteSports || '')
              .split(',')
              .map(value => value.trim().toLocaleLowerCase('pt'));
            const preferred = favorites.find(value =>
              this.sportsCatalog.some(sport => sport.toLocaleLowerCase('pt') === value)
            );
            this.sport = this.sportsCatalog.find(sport =>
              sport.toLocaleLowerCase('pt') === preferred
            ) || '';
          }

          if (!this.locationEdited) {
            this.location = profile.location?.trim() || '';
          }
        }

        this.search();
      });
  }

  onSportChange(value: string): void {
    this.sport = value;
    this.sportEdited = true;
  }

  onLocationChange(value: string): void {
    this.location = value;
    this.locationEdited = true;
    this.disableNearbySessions();
  }

  enableNearbySessions(): void {
    if (this.locatingSessions) {
      return;
    }
    this.nearbySessionError = '';
    if (!navigator.geolocation) {
      this.nearbySessionError = 'unsupported';
      return;
    }

    this.locatingSessions = true;
    const requestId = ++this.nearbyRequestId;
    navigator.geolocation.getCurrentPosition(
      position => {
        if (requestId !== this.nearbyRequestId) {
          return;
        }
        this.locatingSessions = false;
        const { latitude, longitude } = position.coords;
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)
          || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
          this.nearbySessionError = 'unavailable';
          return;
        }
        this.nearbyPosition = { latitude, longitude };
        this.search();
      },
      () => {
        if (requestId !== this.nearbyRequestId) {
          return;
        }
        this.locatingSessions = false;
        this.nearbySessionError = 'unavailable';
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    );
  }

  changeNearbyRadius(radiusKm: number): void {
    if (!this.nearbyPosition || ![10, 25, 50].includes(radiusKm)) {
      return;
    }
    this.nearbyRadiusKm = radiusKm;
    this.search();
  }

  disableNearbySessions(): void {
    ++this.nearbyRequestId;
    this.nearbyPosition = null;
    this.locatingSessions = false;
    this.nearbySessionError = '';
  }

  search(): void {
    this.showAllVenues = false;

    const sport = this.sport.trim();
    const location = this.location.trim();

    this.loading = true;
    this.loadError = false;

    forkJoin({
      venues: this.withRecovery(
        this.venueService.search(
          location || undefined,
          sport || undefined
        ),
        [] as Venue[]
      ),
      sessions: this.withRecovery(
        this.sessionService.discover({
          sport: sport || undefined,
          city: this.nearbyPosition ? undefined : location || undefined,
          latitude: this.nearbyPosition?.latitude,
          longitude: this.nearbyPosition?.longitude,
          radiusKm: this.nearbyPosition ? this.nearbyRadiusKm : undefined,
          availability: 'available',
          sort: this.nearbyPosition ? 'distance' : 'date'
        }),
        [] as SessionSummary[]
      ),
      people: this.withRecovery(
        this.peopleRequest(sport, location),
        [] as CommunityProfile[]
      )
    })
      .pipe(finalize(() => {
        this.loading = false;
        this.initialized = true;
      }))
      .subscribe(({ venues, sessions, people }) => {
        this.venues = venues;
        this.topVenueResults = venues.slice(0, 4);
        this.sessions = sessions;
        this.topSessionResults = sessions.slice(0, 4);
        this.people = people;
        this.topPeopleResults = people.slice(0, 4);
      });
  }

  clear(): void {
    this.disableNearbySessions();
    this.sport = '';
    this.location = '';
    this.sportEdited = true;
    this.locationEdited = true;
    this.search();
  }

  get topVenues(): Venue[] {
    return this.showAllVenues ? this.venues : this.topVenueResults;
  }

  toggleAllVenues(): void {
    this.showAllVenues = !this.showAllVenues;
  }

  get topSessions(): SessionSummary[] {
    return this.topSessionResults;
  }

  get topPeople(): CommunityProfile[] {
    return this.topPeopleResults;
  }

  vacancies(session: SessionSummary): number {
    return Math.max(0, session.maxParticipants - session.participantCount);
  }

  private withRecovery<T>(
    request$: Observable<T>,
    fallback: T
  ): Observable<T> {
    return request$.pipe(
      timeout(10_000),
      retry({ count: 1 }),
      catchError(() => {
        this.loadError = true;
        return of(fallback);
      })
    );
  }

  private peopleRequest(
    sport: string,
    location: string
  ): Observable<CommunityProfile[]> {
    if (!sport && !location) {
      return of([]);
    }

    return this.communityService.findProfiles({
      sport: sport || undefined,
      location: location || undefined
    });
  }
}
