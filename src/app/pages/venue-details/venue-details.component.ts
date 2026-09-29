import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { finalize } from 'rxjs';

import { VenuePhoto, VenueService, VenueSportCondition } from '../../services/venue.service';
import { Venue } from '../model/venue';

@Component({
  selector: 'app-venue-details',
  templateUrl: './venue-details.component.html',
  styleUrls: ['./venue-details.component.css'],
  standalone: false
})
export class VenueDetailsComponent implements OnInit {
  venue: Venue | null = null;
  photos: VenuePhoto[] = [];
  sportConditions: VenueSportCondition[] = [];
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
      this.loadError = true;
      return;
    }

    this.venueService.get(venueId)
      .pipe(finalize(() => this.loading = false))
      .subscribe({
        next: venue => this.venue = venue,
        error: () => this.loadError = true
      });

    this.loadPhotos(venueId);

    this.venueService.listSportConditions(venueId)
      .pipe(finalize(() => this.sportConditionsLoading = false))
      .subscribe({
        next: conditions => this.sportConditions = conditions,
        error: () => {
          this.sportConditions = [];
          this.sportConditionsLoadError = true;
        }
      });
  }

  retryPhotos(): void {
    if (!this.venue) return;
    this.loadPhotos(this.venue.id);
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
      .pipe(finalize(() => this.sportConditionSaving = false))
      .subscribe({
        next: condition => {
          this.sportConditions = [condition, ...this.sportConditions];
          this.sportConditionSport = '';
          this.sportConditionText = '';
        },
        error: () => this.sportConditionSaveError = true
      });
  }

  private loadPhotos(venueId: number): void {
    this.photosLoading = true;
    this.photosLoadError = false;

    this.venueService.listPhotos(venueId)
      .pipe(finalize(() => this.photosLoading = false))
      .subscribe({
        next: photos => this.photos = photos,
        error: () => {
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
      .pipe(finalize(() => this.photoUploading = false))
      .subscribe({
        next: photo => {
          this.photos = [photo, ...this.photos];
          input.value = '';
        },
        error: () => {
          this.photoUploadError = true;
          input.value = '';
        }
      });
  }
}
