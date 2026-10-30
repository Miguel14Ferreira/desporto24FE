import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { GifChoice } from './gif-picker.client';

/** Presentation only: parent owns fetching, send permissions, staging and attachment uploads. */
@Component({
  selector: 'app-chat-emoji-gif-picker',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './chat-emoji-gif-picker.component.html',
  styleUrls: ['./chat-emoji-gif-picker.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChatEmojiGifPickerComponent {
  @Input() tab: 'emoji' | 'gif' = 'emoji';
  @Input() attachmentControlsReady = false;
  @Input() emojis: readonly string[] = [];
  @Input() categories: readonly { icon: string; phrase: string }[] = [];
  @Input() gifQuery = '';
  @Input() gifAvailable: boolean | null = null;
  @Input() gifSelectingId: string | null = null;
  @Input() gifResults: readonly GifChoice[] = [];
  @Input() gifError = '';
  @Input() gifLoading = false;
  @Input() gifHasMore = false;

  @Output() closed = new EventEmitter<void>();
  @Output() tabSelected = new EventEmitter<'emoji' | 'gif'>();
  @Output() emojiSelected = new EventEmitter<string>();
  @Output() queryChanged = new EventEmitter<string>();
  @Output() categorySelected = new EventEmitter<string>();
  @Output() gifSelected = new EventEmitter<GifChoice>();
  @Output() loadMore = new EventEmitter<number>();
  @Output() uploadRequested = new EventEmitter<void>();
}
