import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { TranslatePipe } from '../../i18n/translate.pipe';

export type ClassificationNoteKind = 'profile' | 'inline' | 'race' | 'chess';

/** Read-only hints. Tournament validation and all score rules remain in the parent. */
@Component({
  selector: 'app-tournament-classification-note',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './tournament-classification-note.component.html',
  styleUrls: ['./tournament-classification-note.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class TournamentClassificationNoteComponent {
  @Input({ required: true }) kind!: ClassificationNoteKind;
  @Input() heading = '';
  @Input() description = '';
  @Input() fields = '';
  @Input() unsupported = false;
  @Input() raceSport = '';
}
