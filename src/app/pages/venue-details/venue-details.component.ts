import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { finalize } from 'rxjs';

import { VenueService } from '../../services/venue.service';
import { Venue } from '../model/venue';

@Component({
  selector: 'app-venue-details',
  templateUrl: './venue-details.component.html',
  styleUrls: ['./venue-details.component.css'],
  standalone: false
})
export class VenueDetailsComponent implements OnInit {
  venue: Venue | null = null;
  loading = true;
  loadError = false;

  constructor(
    private route: ActivatedRoute,
    private venueService: VenueService
  ) {}

  ngOnInit(): void {
    const venueId = Number(this.route.snapshot.paramMap.get('id'));

    if (!Number.isFinite(venueId) || venueId <= 0) {
      this.loading = false;
      this.loadError = true;
      return;
    }

    this.venueService.get(venueId)
      .pipe(finalize(() => this.loading = false))
      .subscribe({
        next: venue => this.venue = venue,
        error: () => this.loadError = true
      });
  }
}
