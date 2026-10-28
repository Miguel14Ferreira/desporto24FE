import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnDestroy, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { finalize, Subscription, timeout } from 'rxjs';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { CommunityGroup } from '../model/community-group';
import { Venue } from '../model/venue';
import { VenueService } from '../../services/venue.service';
import { CommunityGroupsService } from '../../services/community-groups.service';

/** Reusable, admin-only venue selector for community setup and settings.
 * Opening a result is read-only. Saving requires a second explicit action. */
@Component({
  selector: 'app-community-habitual-venue-picker',
  templateUrl: './community-habitual-venue-picker.component.html',
  styleUrls: ['./community-habitual-venue-picker.component.css'],
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TranslatePipe]
})
export class CommunityHabitualVenuePickerComponent implements OnDestroy {
  @Input({ required: true }) community!: CommunityGroup;
  @Output() venueSaved = new EventEmitter<CommunityGroup>();

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

  constructor(private venues: VenueService, private groups: CommunityGroupsService) {}

  get canManage(): boolean {
    return this.community?.myRole === 'OWNER' || this.community?.myRole === 'ADMIN';
  }

  search(): void {
    if (!this.canManage || this.searching || this.saving) return;
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
          this.error = 'Não foi possível pesquisar os recintos.';
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
        this.error = 'Não foi possível carregar os detalhes deste recinto.';
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
          this.expanded = null;
          this.results = [];
          this.query = '';
          this.feedback = id === null
            ? 'Recinto habitual removido.'
            : 'Recinto habitual guardado.';
        },
        error: () => {
          if (revision !== this.revision || this.community.id !== communityId) return;
          this.error = 'Não foi possível guardar o recinto habitual.';
        }
      });
    this.subs.add(sub);
  }

  ngOnDestroy(): void {
    ++this.revision;
    this.subs.unsubscribe();
  }
}
