import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { finalize, Subscription, timeout } from 'rxjs';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { CommunityGroup } from '../model/community-group';
import { Venue } from '../model/venue';
import { VenueService } from '../../services/venue.service';
import { CommunityGroupsService } from '../../services/community-groups.service';
import { LocationMethodSelectorComponent } from '../../shared/location-method-selector/location-method-selector.component';
import { appTranslate as t } from '../../i18n/i18n.service';

/** Reusable, admin-only venue selector for community setup and settings.
 * Opening a result is read-only. Saving requires a second explicit action. */
@Component({
  selector: 'app-community-habitual-venue-picker',
  templateUrl: './community-habitual-venue-picker.component.html',
  styleUrls: ['./community-habitual-venue-picker.component.css'],
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TranslatePipe, LocationMethodSelectorComponent]
})
export class CommunityHabitualVenuePickerComponent implements OnChanges, OnDestroy {
  @Input({ required: true }) community!: CommunityGroup;
  @Output() venueSaved = new EventEmitter<CommunityGroup>();

  locationMethod: 'venue' | 'maps' | 'gps' = 'venue';
  mapLink = '';
  resolvingMap = false;
  locating = false;
  resolvingAddress = false;
  locationPoint: {source: 'MAPS' | 'GPS'; latitude: number; longitude: number;
                  city: string; address: string} | null = null;
  query = '';
  results: Venue[] = [];
  expanded: Venue | null = null;
  searching = false;
  detailLoading = false;
  saving = false;
  error = '';
  feedback = '';
  private revision = 0;
  private subs = new Subscription();
  private previousCommunityId: number | null = null;

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['community']) return;
    const id = this.community?.id ?? null;
    if (this.previousCommunityId !== null && this.previousCommunityId !== id) {
      ++this.revision;
      this.subs.unsubscribe();
      this.subs = new Subscription();
      this.query = '';
      this.mapLink = '';
      this.locationPoint = null;
      this.locationMethod = 'venue';
      this.resolvingMap = false;
      this.locating = false;
      this.resolvingAddress = false;
      this.results = [];
      this.expanded = null;
      this.searching = false;
      this.detailLoading = false;
      this.saving = false;
      this.error = '';
      this.feedback = '';
    }
    this.previousCommunityId = id;
  }

  constructor(private venues: VenueService, private groups: CommunityGroupsService) {}

  get canManage(): boolean {
    return this.community?.myRole === 'OWNER' || this.community?.myRole === 'ADMIN';
  }

  chooseLocationMethod(method: 'venue' | 'maps' | 'gps'): void {
    if (!this.canManage || this.saving || this.locationMethod === method) return;
    ++this.revision; // stale Maps, GPS and catalogue requests cannot change the new mode.
    this.locationMethod = method;
    this.results = [];
    this.expanded = null;
    this.query = '';
    this.mapLink = '';
    this.locationPoint = null;
    this.searching = false;
    this.detailLoading = false;
    this.resolvingMap = false;
    this.locating = false;
    this.resolvingAddress = false;
    this.error = '';
    this.feedback = '';
  }

  resolveMapLink(): void {
    if (!this.canManage || this.saving || this.resolvingMap
        || this.locationMethod !== 'maps' || !this.mapLink.trim()) return;
    const revision = ++this.revision, communityId = this.community.id;
    this.resolvingMap = true;
    this.locationPoint = null;
    this.error = '';
    const sub = this.venues.resolveMapLink(this.mapLink.trim())
      .pipe(timeout(12000), finalize(() => {
        if (revision === this.revision) this.resolvingMap = false;
      })).subscribe({
        next: point => {
          if (revision !== this.revision || this.community.id !== communityId
              || this.locationMethod !== 'maps') return;
          if (!this.validPoint(point.latitude, point.longitude)) {
            this.error = t('communities.habitualVenue.errorMapPoint');
            return;
          }
          this.useCoordinates('MAPS', point.latitude, point.longitude, revision);
        },
        error: () => {
          if (revision !== this.revision || this.community.id !== communityId) return;
          this.error = t('communities.habitualVenue.errorMapLink');
        }
      });
    this.subs.add(sub);
  }

  captureCurrentLocation(): void {
    if (!this.canManage || this.saving || this.locating || this.locationMethod !== 'gps') return;
    if (!navigator.geolocation) {
      this.error = t('communities.habitualVenue.errorGpsUnsupported');
      return;
    }
    const revision = ++this.revision, communityId = this.community.id;
    this.locating = true;
    this.locationPoint = null;
    this.error = '';
    navigator.geolocation.getCurrentPosition(
      position => {
        if (revision !== this.revision || this.community.id !== communityId
            || this.locationMethod !== 'gps') return;
        this.locating = false;
        const { latitude, longitude } = position.coords;
        if (!this.validPoint(latitude, longitude)) {
          this.error = t('communities.habitualVenue.errorGpsInvalid');
          return;
        }
        this.useCoordinates('GPS', latitude, longitude, revision, position.coords.accuracy);
      },
      () => {
        if (revision !== this.revision || this.community.id !== communityId) return;
        this.locating = false;
        this.error = t('communities.habitualVenue.errorGpsPermission');
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  }

  private validPoint(lat: number, lng: number): boolean {
    return Number.isFinite(lat) && Number.isFinite(lng)
      && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  }

  private useCoordinates(source: 'MAPS' | 'GPS', latitude: number,
                         longitude: number, revision: number, accuracy?: number): void {
    this.locationPoint = {source, latitude, longitude, city: '', address: ''};
    const communityId = this.community.id;
    this.resolvingAddress = true;
    const sub = this.venues.reverseLocation(latitude, longitude, accuracy)
      .pipe(timeout(20000), finalize(() => {
        if (revision === this.revision && this.community.id === communityId) this.resolvingAddress = false;
      })).subscribe({
        next: result => {
          if (revision !== this.revision || communityId !== this.community.id
              || this.locationPoint?.source !== source) return;
          // Addresses from reverse geocoding are suggestions, not verified postal facts.
          if (!this.locationPoint.city.trim()) this.locationPoint.city = result.city ?? '';
          if (!this.locationPoint.address.trim()) this.locationPoint.address = result.address ?? '';
        },
        error: () => { /* Coordinates can still be saved without a postal address. */ }
      });
    this.subs.add(sub);
  }

  savePoint(): void {
    const point = this.locationPoint;
    if (!point || !this.canManage || this.saving || this.resolvingAddress
        || (this.locationMethod === 'maps' && point.source !== 'MAPS')
        || (this.locationMethod === 'gps' && point.source !== 'GPS')) return;
    const communityId = this.community.id, revision = ++this.revision;
    this.saving = true;
    this.error = '';
    this.feedback = '';
    const sub = this.groups.updateHabitualLocation(communityId, point.source,
      point.latitude, point.longitude, point.city.trim() || null,
      point.address.trim() || null)
      .pipe(timeout(10000), finalize(() => {
        if (revision === this.revision) this.saving = false;
      })).subscribe({
        next: group => {
          if (revision !== this.revision || this.community.id !== communityId) return;
          this.community = group;
          this.venueSaved.emit(group);
          this.feedback = t('communities.habitualVenue.pointSaved');
        },
        error: () => {
          if (revision !== this.revision || this.community.id !== communityId) return;
          this.error = t('communities.habitualVenue.errorSavePoint');
        }
      });
    this.subs.add(sub);
  }

  get mapPointUrl(): string | null {
    const p = this.locationPoint;
    return p ? 'https://www.google.com/maps?q=' + p.latitude + ',' + p.longitude : null;
  }

  search(): void {
    if (!this.canManage || this.searching || this.saving || this.locationMethod !== 'venue') return;
    const query = this.query.trim();
    if (!query) return;
    const revision = ++this.revision;
    const communityId = this.community.id;
    this.error = '';
    this.feedback = '';
    this.results = [];
    this.expanded = null;
    this.detailLoading = false;
    this.searching = true;
    const sports = this.community.sports?.length ? this.community.sports
      : this.community.sport ? [this.community.sport] : [];
    const sub = this.venues.suggest(query, undefined, sports.length === 1 ? sports[0] : undefined, 0)
      .pipe(timeout(10000), finalize(() => {
        if (revision === this.revision) this.searching = false;
      }))
      .subscribe({
        next: result => {
          if (revision !== this.revision || this.community.id !== communityId) return;
          this.results = result.venues;
        },
        error: () => {
          if (revision !== this.revision || this.community.id !== communityId) return;
          this.error = t('communities.habitualVenue.errorSearch');
        }
      });
    this.subs.add(sub);
  }

  openDetails(id: number): void {
    if (!this.canManage || this.saving || this.detailLoading) return;
    if (!this.results.some(venue => venue.id === id)) return;
    const revision = ++this.revision;
    const communityId = this.community.id;
    this.searching = false;
    this.detailLoading = true;
    this.expanded = null;
    this.error = '';
    this.feedback = '';
    const sub = this.venues.get(id).pipe(timeout(10000), finalize(() => {
      if (revision === this.revision) this.detailLoading = false;
    })).subscribe({
      next: venue => {
        if (revision !== this.revision || this.community.id !== communityId || venue.id !== id) return;
        this.expanded = venue;
      },
      error: () => {
        if (revision !== this.revision || this.community.id !== communityId) return;
        this.error = t('communities.habitualVenue.errorDetails');
      }
    });
    this.subs.add(sub);
  }

  get mapUrl(): string | null {
    const v = this.expanded;
    if (!v || v.latitude === null || v.longitude === null ||
        !Number.isFinite(v.latitude) || !Number.isFinite(v.longitude)
        || Math.abs(v.latitude) > 90 || Math.abs(v.longitude) > 180) return null;
    return 'https://www.google.com/maps?q=' + v.latitude + ',' + v.longitude;
  }

  save(id: number | null): void {
    if (!this.canManage || this.saving
        || (id !== null && this.expanded?.id !== id)) return;
    const communityId = this.community.id;
    const revision = ++this.revision;
    this.saving = true;
    this.error = '';
    this.feedback = '';
    const sub = this.groups.updateDefaultVenue(communityId, id)
      .pipe(timeout(10000), finalize(() => {
        if (revision === this.revision) this.saving = false;
      })).subscribe({
        next: group => {
          if (revision !== this.revision || this.community.id !== communityId) return;
          this.community = group;
          this.venueSaved.emit(group);
          this.locationPoint = null;
          this.expanded = null;
          this.results = [];
          this.query = '';
          this.feedback = id === null
            ? t('communities.habitualVenue.venueRemoved')
            : t('communities.habitualVenue.venueSaved');
        },
        error: () => {
          if (revision !== this.revision || this.community.id !== communityId) return;
          this.error = t('communities.habitualVenue.errorSaveVenue');
        }
      });
    this.subs.add(sub);
  }

  ngOnDestroy(): void {
    ++this.revision;
    this.subs.unsubscribe();
  }
}
