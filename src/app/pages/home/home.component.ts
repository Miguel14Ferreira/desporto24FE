import { Component, OnDestroy, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { Subject, takeUntil, timeout } from 'rxjs';

import { SessionSummary } from '../model/session-summary';
import { Venue } from '../model/venue';
import { SessionService } from '../../services/session.service';
import { VenueService } from '../../services/venue.service';

@Component({
    selector: 'app-home',
    templateUrl: './home.component.html',
    styleUrls: ['./home.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class HomeComponent implements OnInit, OnDestroy {
  dark = true;
  featuredSessions: SessionSummary[] = [];
  featuredVenues: Venue[] = [];
  sessionsLoading = true;
  venuesLoading = true;
  sessionsLoadError = false;
  venuesLoadError = false;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly sessionService: SessionService,
    private readonly venueService: VenueService
  ) {}

  ngOnInit(): void {
    this.dark = localStorage.getItem('theme') !== 'claro';
    // Public discovery only: never expose private or community-only sessions.
    this.sessionService.discover({ privateGame: false, from: new Date().toISOString() })
      .pipe(timeout(8000), takeUntil(this.destroy$))
      .subscribe({
        next: sessions => {
          const now = Date.now();
          this.featuredSessions = (Array.isArray(sessions) ? sessions : [])
            .filter(item => item && item.privateGame === false
              && item.audience !== 'COMMUNITY_ONLY'
              && (item.status === 'OPEN' || item.status === 'FULL')
              && Number.isFinite(Date.parse(item.gameDate))
              && Date.parse(item.gameDate) > now)
            .sort((first, second) =>
              Date.parse(first.gameDate) - Date.parse(second.gameDate))
            .slice(0, 3);
          this.sessionsLoading = false;
        },
        error: () => {
          this.sessionsLoadError = true;
          this.sessionsLoading = false;
        }
      });

    // Browse at most three bounded pages: a page with missing sports must not
    // hide valid facilities further down the public catalogue.
    this.loadFeaturedVenues(0, []);
  }

  private loadFeaturedVenues(page: number, selected: Venue[]): void {
    this.venueService.suggest(undefined, undefined, undefined, page)
      .pipe(timeout(8000), takeUntil(this.destroy$))
      .subscribe({
        next: response => {
          const valid = (response?.venues ?? [])
            .filter(item => item && item.name?.trim()
              && item.city?.trim() && item.sports?.trim()
              && !selected.some(existing => existing.id === item.id));
          const found = [...selected, ...valid].slice(0, 4);

          if (found.length < 4 && response?.hasMore && page < 2) {
            this.loadFeaturedVenues(page + 1, found);
            return;
          }

          this.featuredVenues = found;
          this.venuesLoading = false;
        },
        error: () => {
          // Keep valid results collected from earlier pages if a later page fails.
          this.featuredVenues = selected;
          this.venuesLoadError = selected.length === 0;
          this.venuesLoading = false;
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
