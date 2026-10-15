import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
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
  playerName = '';
  appliedPlayerName = '';
  loadingPeople = false;
  playerSearchError = false;
  private sportEdited = false;
  private locationEdited = false;
  venues: Venue[] = [];
  topVenueResults: Venue[] = [];
  sessions: SessionSummary[] = [];
  topSessionResults: SessionSummary[] = [];
  people: CommunityProfile[] = [];
  topPeopleResults: CommunityProfile[] = [];

  locatingVenues = false;
  nearbyVenueError = '';
  nearbyVenueRadiusKm = 25;
  nearbyVenuePosition: { latitude: number; longitude: number } | null = null;
  private nearbyVenueRequestId = 0;

  locatingSessions = false;
  nearbySessionError = '';
  nearbyRadiusKm = 25;
  nearbyPosition: { latitude: number; longitude: number } | null = null;
  private nearbyRequestId = 0;

  loading = false;
  initialized = false;
  loadError = false;
  showAllVenues = false;
  showAllSessions = false;
  showAllPeople = false;

  constructor(
    private authenticationService: AuthenticationService,
    private venueService: VenueService,
    private sessionService: SessionService,
    private communityService: CommunityService,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.authenticationService.isLoggedIn();

    // Explicit return filters take precedence over suggestions from the public profile.
    const params = this.route.snapshot.queryParamMap;
    if (params.has('sport') || params.has('city') || params.has('player')) {
      this.sport = (params.get('sport') || '').trim();
      this.location = (params.get('city') || '').trim();
      this.playerName = (params.get('player') || '').trim();
      this.appliedPlayerName = this.playerName;
      this.sportEdited = true;
      this.locationEdited = true;
    }

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
    this.playerName = '';
    this.appliedPlayerName = '';
  }

  onLocationChange(value: string): void {
    this.location = value;
    this.locationEdited = true;
    this.playerName = '';
    this.appliedPlayerName = '';
    this.disableNearbySessions();
    this.disableNearbyVenues();
  }

  enableNearbyVenues(): void {
    if (this.locatingVenues) {
      return;
    }
    this.nearbyVenueError = '';
    if (!navigator.geolocation) {
      this.nearbyVenueError = 'unsupported';
      return;
    }

    this.locatingVenues = true;
    const requestId = ++this.nearbyVenueRequestId;
    navigator.geolocation.getCurrentPosition(
      position => {
        if (requestId !== this.nearbyVenueRequestId) {
          return;
        }
        this.locatingVenues = false;
        const { latitude, longitude } = position.coords;
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)
          || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
          this.nearbyVenueError = 'unavailable';
          return;
        }
        this.nearbyVenuePosition = { latitude, longitude };
        this.search();
      },
      () => {
        if (requestId !== this.nearbyVenueRequestId) {
          return;
        }
        this.locatingVenues = false;
        this.nearbyVenueError = 'unavailable';
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    );
  }

  changeNearbyVenueRadius(radiusKm: number): void {
    if (!this.nearbyVenuePosition || ![10, 25, 50].includes(radiusKm)) {
      return;
    }
    this.nearbyVenueRadiusKm = radiusKm;
    this.search();
  }

  disableNearbyVenues(): void {
    ++this.nearbyVenueRequestId;
    this.nearbyVenuePosition = null;
    this.locatingVenues = false;
    this.nearbyVenueError = '';
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
    this.showAllSessions = false;
    this.showAllPeople = false;

    const sport = this.sport.trim();
    const location = this.location.trim();

    this.loading = true;
    this.loadError = false;

    forkJoin({
      venues: this.withRecovery(
        this.nearbyVenuePosition
          ? this.venueService.search(
              undefined, sport || undefined,
              this.nearbyVenuePosition.latitude, this.nearbyVenuePosition.longitude,
              this.nearbyVenueRadiusKm)
          : this.venueService.search(location || undefined, sport || undefined),
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

  searchPlayers(): void {
    if (this.loading || this.loadingPeople) {
      return;
    }

    this.loadingPeople = true;
    this.showAllPeople = false;
    this.playerSearchError = false;
    this.appliedPlayerName = this.playerName.trim();
    this.peopleRequest(this.sport.trim(), this.location.trim())
      .pipe(
        timeout(10_000),
        retry({ count: 1 }),
        catchError(() => {
          this.playerSearchError = true;
          return of([] as CommunityProfile[]);
        }),
        finalize(() => { this.loadingPeople = false; })
      )
      .subscribe(people => {
        this.people = people;
        this.topPeopleResults = people.slice(0, 4);
      });
  }

  clearPlayerName(): void {
    this.playerName = '';
    this.searchPlayers();
  }

  clear(): void {
    this.playerName = '';
    this.appliedPlayerName = '';
    this.playerSearchError = false;
    this.disableNearbySessions();
    this.disableNearbyVenues();
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
    return this.showAllSessions ? this.sessions : this.topSessionResults;
  }

  toggleAllSessions(): void {
    this.showAllSessions = !this.showAllSessions;
  }

  get topPeople(): CommunityProfile[] {
    return this.appliedPlayerName || this.showAllPeople ? this.people : this.topPeopleResults;
  }

  toggleAllPeople(): void {
    this.showAllPeople = !this.showAllPeople;
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
    const name = this.playerName.trim();
    if (name) {
      return this.communityService.findProfiles({ name });
    }
    if (!sport && !location) {
      return of([]);
    }

    return this.communityService.findProfiles({
      sport: sport || undefined,
      location: location || undefined
    });
  }
}
