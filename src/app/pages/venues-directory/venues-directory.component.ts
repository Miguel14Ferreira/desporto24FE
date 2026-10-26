import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subject, takeUntil, timeout } from 'rxjs';

import { TranslatePipe } from '../../i18n/translate.pipe';
import { VenueService } from '../../services/venue.service';
import { isVenueGpsOnly, venuePostalAddress } from '../../shared/venue-location';
import { SPORTS_CATALOG } from '../../shared/sports-catalog';
import { PORTUGAL_VENUE_REGIONS } from '../../shared/portugal-districts';
import { Venue } from '../model/venue';

@Component({
  selector: 'app-venues-directory',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslatePipe],
  templateUrl: './venues-directory.component.html',
  styleUrls: ['./venues-directory.component.css']
})
export class VenuesDirectoryComponent implements OnInit, OnDestroy {
  readonly sportsCatalog = SPORTS_CATALOG;
  readonly districts = PORTUGAL_VENUE_REGIONS;

  name = '';
  city = '';
  district = '';
  sport = '';
  venues: Venue[] = [];
  page = 0;
  hasMore = false;
  loading = false;
  loadError = false;
  private requestVersion = 0;
  private readonly destroyed = new Subject<void>();

  constructor(
    private readonly venuesApi: VenueService,
    private readonly route: ActivatedRoute,
    private readonly changeDetector: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const params = this.route.snapshot.queryParamMap;
    this.name = params.get('name') || '';
    this.city = params.get('city') || '';
    this.district = params.get('district') || '';
    this.sport = params.get('sport') || '';
    this.search();
  }

  search(page = 0): void {
    if (!Number.isInteger(page) || page < 0) return;
    const request = ++this.requestVersion;
    this.page = page;
    this.loading = true;
    this.loadError = false;
    this.venuesApi.suggest(this.name, this.city, this.sport, page, this.district)
      .pipe(timeout({ first: 12000 }), takeUntil(this.destroyed))
      .subscribe({
        next: response => {
          if (request !== this.requestVersion) return;
          this.venues = response.venues || [];
          this.hasMore = response.hasMore === true;
          this.loading = false;
          this.changeDetector.markForCheck();
        },
        error: () => {
          if (request !== this.requestVersion) return;
          this.venues = [];
          this.hasMore = false;
          this.loading = false;
          this.loadError = true;
          this.changeDetector.markForCheck();
        }
      });
  }

  reset(): void {
    this.name = '';
    this.city = '';
    this.district = '';
    this.sport = '';
    this.search(0);
  }

  get showReset(): boolean {
    return !!(this.name || this.city || this.district || this.sport);
  }

  venueAddress(venue: Venue): string {
    return venuePostalAddress(venue) || (isVenueGpsOnly(venue)
      ? '' : (venue.address || '').trim());
  }

  sports(venue: Venue): string[] {
    return (venue.sports || '').split(/[,;]+/).map(x => x.trim()).filter(Boolean).slice(0, 4);
  }

  ngOnDestroy(): void {
    ++this.requestVersion;
    this.destroyed.next();
    this.destroyed.complete();
  }
}
