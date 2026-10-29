import { ChangeDetectorRef, Component, Input, OnDestroy, OnInit } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { I18nService } from '../../i18n/i18n.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { venueCatalogueDisplayLabel } from '../venue-catalogue-display';

/** Sport names arrive as a legacy semicolon/comma/pipe-separated string from APIs. */
export function parseVenueSports(value: string | null | undefined): string[] {
  if (!value?.trim()) return [];
  const seen = new Set<string>();
  return value.split(/[;,|]+/).map(sport => sport.trim()).filter(sport => {
    if (!sport) return false;
    const key = sport.toLocaleLowerCase('pt-PT');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Same presentation for the venue directory, detail and community picker. */
@Component({
  selector: 'app-venue-sports-badges',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    @if (items.length) {
      <div class="venue-sports-list" [class.is-compact]="compact">
        @for (sport of displayedSports; track sport) {
          <span class="venue-sports-chip">{{ displaySport(sport) }}</span>
        }
        @if (remainingCount > 0) {
          @if (expandable) {
            <button type="button" class="venue-sports-more" (click)="expanded = true"
                    [attr.aria-expanded]="false">
              {{ 'venue.sportsBadge.more' | t:{count: remainingCount} }}
            </button>
          } @else {
            <span class="venue-sports-counter"
                  [attr.aria-label]="('venue.sportsBadge.more' | t:{count: remainingCount})">
              +{{ remainingCount }}
            </span>
          }
        }
        @if (expandable && expanded && items.length > limit && limit > 0) {
          <button type="button" class="venue-sports-more" (click)="expanded = false"
                  [attr.aria-expanded]="true">{{ 'venue.sportsBadge.less' | t }}</button>
        }
      </div>
    }
  `,
  styles: [`
    :host { display: block; min-width: 0; }
    .venue-sports-list { display: flex; flex-wrap: wrap; align-items: center; gap: 7px; min-width: 0; }
    .venue-sports-chip {
      display: inline-flex; align-items: center; gap: 7px; min-width: 0; max-width: 100%;
      padding: 7px 11px; border-radius: 999px;
      background: rgba(35, 147, 126, .17); border: 1px solid rgba(85, 220, 187, .35);
      color: #d8fff4; font-size: .83rem; font-weight: 670; line-height: 1.35;
      overflow-wrap: anywhere; white-space: normal;
    }
    .venue-sports-chip::before {
      content: ''; flex: 0 0 6px; width: 6px; height: 6px; border-radius: 50%;
      background: #57e8b5; box-shadow: 0 0 0 2px rgba(87, 232, 181, .14);
    }
    .venue-sports-counter, .venue-sports-more {
      display: inline-flex; align-items: center; justify-content: center;
      min-height: 32px; padding: 5px 11px; border: 1px solid rgba(144, 199, 214, .35);
      border-radius: 999px; background: rgba(147, 197, 213, .1); color: #c8e3ec;
      font: inherit; font-size: .79rem; font-weight: 780; line-height: 1.25;
    }
    .venue-sports-more { cursor: pointer; }
    .venue-sports-more:hover { background: rgba(87, 232, 181, .16); border-color: #5ce6c0; color: #e6fff5; }
    .venue-sports-more:focus-visible { outline: 2px solid #a7fce1; outline-offset: 3px; }
    .is-compact { gap: 5px; }
    .is-compact .venue-sports-chip, .is-compact .venue-sports-counter {
      padding: 5px 9px; font-size: .75rem; min-height: 27px; box-sizing: border-box;
    }
    @media (max-width: 480px) {
      .venue-sports-chip { font-size: .78rem; padding: 6px 9px; }
    }
  `]
})
export class VenueSportsBadgesComponent implements OnInit, OnDestroy {
  private readonly destroyed = new Subject<void>();

  constructor(private readonly i18n: I18nService,
    private readonly changeDetector: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.i18n.languageChanges$.pipe(takeUntil(this.destroyed)).subscribe(() => {
      this.changeDetector.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.destroyed.next();
    this.destroyed.complete();
  }

  displaySport(sport: string): string {
    return venueCatalogueDisplayLabel(sport, 'sport');
  }

  items: string[] = [];
  expanded = false;
  @Input() limit = 0;
  @Input() compact = false;
  @Input() expandable = false;

  @Input() set sports(value: string | null | undefined) {
    this.items = parseVenueSports(value);
    this.expanded = false;
  }

  get displayedSports(): string[] {
    return this.expanded || this.limit <= 0 ? this.items : this.items.slice(0, this.limit);
  }

  get remainingCount(): number {
    return this.expanded || this.limit <= 0 ? 0 : Math.max(0, this.items.length - this.limit);
  }
}
