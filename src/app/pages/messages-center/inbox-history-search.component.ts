import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { InboxMessage } from './inbox.model';

/** Query results and controls only. Search, pagination, authorization and navigation stay with MessagesCenterComponent. */
@Component({
  selector: 'section[app-inbox-history-search]',
  standalone: true,
  imports: [FormsModule, TranslatePipe],
  templateUrl: './inbox-history-search.component.html',
  styleUrls: ['./inbox-history-search.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InboxHistorySearchComponent {
  @Input() messageSearchTerm = '';
  @Input() messageSearchResults: readonly InboxMessage[] = [];
  @Input() messageSearchLoading = false;
  @Input() messageSearchError = false;
  @Input() messageSearchSearched = false;
  @Input() messageSearchHasMore = false;
  @Input() messageSearchPage = 0;
  @Input() selectedSearchResultId: number | null = null;
  @Input() historyLocateLoading = false;
  @Input() historyLocateError = false;
  @Input() composerAllowed = false;
  @Input() sending = false;
  @Input() deliveryUncertain = false;
  @Input() dateFormatter: (date: string) => string = value => value;
  @Input() previewFormatter: (text: string) => string = value => value;
  @Output() termChanged = new EventEmitter<string>();
  @Output() searchRequested = new EventEmitter<number>();
  @Output() locateRequested = new EventEmitter<InboxMessage>();
  @Output() replyRequested = new EventEmitter<InboxMessage>();
}
