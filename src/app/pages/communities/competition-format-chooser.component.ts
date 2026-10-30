import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { TranslatePipe } from '../../i18n/translate.pipe';
export type TournamentCreationFormat = 'LEAGUE' | 'KNOCKOUT' | 'GROUP_KNOCKOUT';
/** Visual format choice; all supported-format validation stays in parent. */
@Component({
  selector: 'app-competition-format-chooser',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './competition-format-chooser.component.html',
  styleUrls: ['./competition-format-chooser.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CompetitionFormatChooserComponent {
  @Input({ required: true }) selectedFormat!: TournamentCreationFormat;
  @Input() disabled = false;
  @Output() formatSelected = new EventEmitter<TournamentCreationFormat>();
}
