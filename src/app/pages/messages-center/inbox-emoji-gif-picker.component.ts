import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { GifChoice } from './gif-picker.client';

/**
 * Presentational picker only. All GIPHY network searches, fallback catalog,
 * attachment permissions, composer state and GIF selection checks stay in the parent.
 * Attribute selector keeps the original section/dialog and absolute positioning.
 */
@Component({
  selector: 'section[app-inbox-emoji-gif-picker]',
  standalone: true,
  imports: [FormsModule, TranslatePipe],
  templateUrl: './inbox-emoji-gif-picker.component.html',
  styleUrls: ['./inbox-emoji-gif-picker.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InboxEmojiGifPickerComponent {
  @Input() pickerTab: 'emoji' | 'gif' = 'emoji';
  @Input() attachmentControlsReady = false;
  @Input() composerEmojis: readonly string[] = [];
  @Input() gifQuery = '';
  @Input() gifCategories: readonly { phrase: string; icon: string }[] = [];
  @Input() gifAvailable: boolean | null = null;
  @Input() gifSelectingId: string | null = null;
  @Input() gifResults: readonly GifChoice[] = [];
  @Input() gifLoading = false;
  @Input() gifError = '';
  @Input() gifHasMore = false;
  @Output() tabSelected = new EventEmitter<'emoji' | 'gif'>();
  @Output() closeRequested = new EventEmitter<void>();
  @Output() emojiSelected = new EventEmitter<string>();
  @Output() queryChanged = new EventEmitter<string>();
  @Output() categorySelected = new EventEmitter<string>();
  @Output() gifSelected = new EventEmitter<GifChoice>();
  @Output() moreRequested = new EventEmitter<number>();
  @Output() uploadRequested = new EventEmitter<void>();
}
