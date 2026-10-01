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
  venues: Venue[] = [];
  sessions: SessionSummary[] = [];
  people: CommunityProfile[] = [];

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
      .pipe(catchError(() => of(null)))
      .subscribe(profile => {
        if (profile) {
          this.sport = profile.favoriteSports
            ?.split(',')
            .map(value => value.trim())
            .find(Boolean) || '';

          this.location = profile.location?.trim() || '';
        }

        this.search();
      });
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
          city: location || undefined,
          availability: 'available',
          sort: 'date'
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
        this.sessions = sessions;
        this.people = people;
      });
  }

  clear(): void {
    this.sport = '';
    this.location = '';
    this.search();
  }

  get topVenues(): Venue[] {
    return this.showAllVenues ? this.venues : this.venues.slice(0, 4);
  }

  toggleAllVenues(): void {
    this.showAllVenues = !this.showAllVenues;
  }

  get topSessions(): SessionSummary[] {
    return this.sessions.slice(0, 4);
  }

  get topPeople(): CommunityProfile[] {
    return this.people.slice(0, 4);
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
      return this.communityService.discoverProfiles()
        .pipe(catchError(() => of([])));
    }

    return this.communityService.findProfiles({
      sport: sport || undefined,
      location: location || undefined
    }).pipe(
      catchError(() => this.communityService.discoverProfiles()
        .pipe(catchError(() => of([]))))
    );
  }
}
