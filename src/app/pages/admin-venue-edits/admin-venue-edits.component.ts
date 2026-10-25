import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subject, finalize, takeUntil, timeout } from 'rxjs';

import { TranslatePipe } from '../../i18n/translate.pipe';
import {
  VenueEditField, VenueEditSuggestion, VenueEditSuggestionsService
} from '../../services/venue-edit-suggestions.service';

@Component({
  selector: 'app-admin-venue-edits',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslatePipe],
  templateUrl: './admin-venue-edits.component.html',
  styleUrls: ['./admin-venue-edits.component.css']
})
export class AdminVenueEditsComponent implements OnInit, OnDestroy {
  suggestions: VenueEditSuggestion[] = [];
  selected: VenueEditSuggestion | null = null;
  action: 'approve' | 'reject' | null = null;
  note = '';
  page = 0;
  hasMore = false;
  loading = false;
  loadError = false;
  actionError = false;
  updating = false;
  private version = 0;
  private readonly destroyed = new Subject<void>();

  constructor(private readonly api: VenueEditSuggestionsService,
    private readonly cdr: ChangeDetectorRef) {}

  ngOnInit(): void { this.load(0); }

  load(page = this.page): void {
    if (!Number.isInteger(page) || page < 0 || page > 1000) return;
    const request = ++this.version;
    this.page = page;
    this.loading = true;
    this.loadError = false;
    this.api.pending(page).pipe(timeout(12000), takeUntil(this.destroyed)).subscribe({
      next: response => {
        if (request !== this.version) return;
        this.suggestions = response.suggestions;
        this.hasMore = response.hasMore;
        this.selected = null;
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: () => {
        if (request !== this.version) return;
        this.suggestions = [];
        this.loading = false;
        this.loadError = true;
        this.cdr.markForCheck();
      }
    });
  }

  fields(item: VenueEditSuggestion): VenueEditField[] {
    return Object.keys(item.proposed) as VenueEditField[];
  }

  open(item: VenueEditSuggestion): void {
    this.selected = item;
    this.action = null;
    this.note = '';
    this.actionError = false;
  }

  close(): void {
    if (this.updating) return;
    this.selected = null;
    this.action = null;
  }

  decide(): void {
    if (!this.selected || !this.action || this.updating) return;
    if (this.action === 'reject' && this.note.trim().length < 5) {
      this.actionError = true;
      return;
    }
    const id = this.selected.id, decision = this.action;
    this.updating = true;
    this.actionError = false;
    this.api.decide(id, decision, this.note.trim())
      .pipe(timeout(12000), takeUntil(this.destroyed),
        finalize(() => { this.updating = false; this.cdr.markForCheck(); }))
      .subscribe({
        next: () => {
          this.suggestions = this.suggestions.filter(x => x.id !== id);
          this.selected = null;
          this.action = null;
          if (!this.suggestions.length && this.hasMore) this.load(this.page);
          this.cdr.markForCheck();
        },
        error: () => {
          // Includes 409 for a stale venue field; never auto-repeat a write.
          this.actionError = true;
          this.cdr.markForCheck();
        }
      });
  }

  ngOnDestroy(): void {
    ++this.version;
    this.destroyed.next();
    this.destroyed.complete();
  }
}
