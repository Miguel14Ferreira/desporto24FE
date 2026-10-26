import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { ShareChoice, ShareKind } from './share-message';
/** Visual state only; safe membership discovery, filtering and validation remain in MessagesCenterComponent. */
@Component({
  selector: 'section[app-inbox-share-picker]', standalone: true,
  imports: [FormsModule, TranslatePipe],
  templateUrl: './inbox-share-picker.component.html',
  styleUrls: ['./inbox-share-picker.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InboxSharePickerComponent {
  @Input() sharePickerTab: ShareKind = 'profile';
  @Input() sharePickerSearch = '';
  @Input() sharePickerLoading = false;
  @Input() sharePickerError = false;
  @Input() choices: readonly ShareChoice[] = [];
  @Output() tabChanged = new EventEmitter<ShareKind>();
  @Output() searchChanged = new EventEmitter<string>();
  @Output() choiceSelected = new EventEmitter<ShareChoice>();
  @Output() closeRequested = new EventEmitter<void>();
}
