import { Component, EventEmitter, Input, Output } from '@angular/core';
import { TranslatePipe } from '../../i18n/translate.pipe';

export type LocationMethod = 'venue' | 'maps' | 'gps';

/** One location-source switcher for session creation and habitual community location. */
@Component({
  selector: 'app-location-method-selector',
  standalone: true,
  imports: [TranslatePipe],
  template: `
    <div class="location-methods" role="group" [attr.aria-label]="'createSession.locationMethods' | t">
      @for (method of methods; track method) {
        <button type="button" class="location-method"
                [class.active]="value === method" [attr.aria-pressed]="value === method"
                [disabled]="disabled" (click)="select(method)">
          {{ ('createSession.locationMethod.' + method) | t }}
        </button>
      }
    </div>
  `,
  styles: [`
    :host { display: block; min-width: 0; }
    .location-methods { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .6rem; }
    .location-method {
      min-width: 0; padding: .85rem .5rem; min-height: 48px; border-radius: .85rem;
      border: 1px solid rgba(148, 163, 184, .4); background: rgba(15, 23, 42, .5);
      color: #e2e8f0; font: inherit; font-weight: 750; text-align: center; cursor: pointer;
    }
    .location-method.active, .location-method[aria-pressed='true'] {
      border-color: #00e676; background: rgba(0, 230, 118, .1); color: #b9f6ca;
    }
    .location-method:focus-visible { outline: 3px solid #7dd3fc; outline-offset: 2px; }
    .location-method:disabled { opacity: .6; cursor: not-allowed; }
    @media (max-width: 540px) { .location-methods { grid-template-columns: 1fr; } }
  `]
})
export class LocationMethodSelectorComponent {
  @Input({ required: true }) value: LocationMethod = 'venue';
  @Input() disabled = false;
  @Output() valueChange = new EventEmitter<LocationMethod>();
  readonly methods: readonly LocationMethod[] = ['venue', 'maps', 'gps'];

  select(method: LocationMethod): void {
    if (!this.disabled && method !== this.value) this.valueChange.emit(method);
  }
}
