import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '../../i18n/translate.pipe';

/** Presentation-only introduction shown in public community discovery.
 * The parent controls loading, search behavior and which view is visible.
 */
@Component({
  selector: 'app-community-discovery-pitch',
  standalone: true,
  imports: [RouterLink, TranslatePipe],
  templateUrl: './community-discovery-pitch.component.html',
  styleUrls: ['./community-discovery-pitch.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CommunityDiscoveryPitchComponent {
  @Input() communitySearchLoading = false;
  @Output() exploreRequested = new EventEmitter<void>();
}
