import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, ElementRef, Input, OnChanges, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { skip, Subscription } from 'rxjs';
import {
  CHAT_REACTION_EMOJIS, ChatReactionKind,
  ChatReactionStoreService, ChatReactionSummary
} from '../../services/chat-reaction-store.service';
import { TranslatePipe } from '../../i18n/translate.pipe';

let reactionPickerSequence = 0;

/** Reusable compact emoji reactions; the store coalesces sibling messages into one GET. */
@Component({
  selector: 'app-chat-reactions',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  // The bubble can reserve room only when reaction badges exist.
  host: {
    '[class.has-reactions]': 'entries.length > 0',
    '[class.is-picker-open]': 'expanded'
  },
  template: `
    <div class="chat-reactions" (keydown.escape)="dismissPicker($event)" (focusout)="onFocusOut($event)">
      <div class="reaction-badges">
        @for (entry of entries; track entry.emoji) {
          <button type="button" class="reaction-count"
              [class.mine]="summary?.myEmoji === entry.emoji"
              [disabled]="disabled || store.isBusy(kind, conversationId, messageId)"
              [attr.aria-label]="('chat.changeReaction' | t) + ': ' + entry.emoji + ' · ' + entry.count"
              [attr.aria-expanded]="expanded" [attr.aria-controls]="pickerId"
              [attr.aria-pressed]="summary?.myEmoji === entry.emoji"
              (click)="togglePicker($event)">
            {{ entry.emoji }} <span>{{ entry.count }}</span>
          </button>
        }
        @if (!disabled && entries.length === 0) {
          <button #reactionToggle type="button" class="reaction-open"
              [attr.aria-expanded]="expanded" [attr.aria-controls]="pickerId"
              [attr.aria-label]="'chat.react' | t"
              [disabled]="store.isBusy(kind, conversationId, messageId)"
              (click)="togglePicker($event)">
            <span aria-hidden="true">☺</span><span class="sr-only">{{ 'chat.react' | t }}</span>
          </button>
        }
      </div>
      @if (expanded && !disabled) {
        <!-- Inline panel grows the message row instead of covering the message or date. -->
        <div [id]="pickerId" class="reaction-picker" role="group" [attr.aria-label]="'chat.react' | t">
          @if (summary; as state) {
            <div class="reaction-choices">
              @for (emoji of emojis; track emoji) {
                <button type="button" class="reaction-choice" [attr.aria-label]="emoji"
                  [attr.aria-pressed]="state.myEmoji === emoji"
                  [disabled]="store.isBusy(kind, conversationId, messageId)"
                  (click)="pick(emoji)">{{ emoji }}</button>
              }
            </div>
            @if (state.myEmoji) {
              <div class="reaction-picker-footer">
                <button type="button" class="reaction-remove"
                  [disabled]="store.isBusy(kind, conversationId, messageId)"
                  (click)="remove()"><span aria-hidden="true">×</span>{{ 'chat.removeReaction' | t }}</button>
              </div>
            }
          } @else if (store.hasFailed(kind, conversationId, messageId)) {
            <span class="reaction-load-error" role="alert">{{ 'chat.reactionError' | t }}</span>
            <button type="button" class="reaction-retry" (click)="retry()">{{ 'common.retry' | t }}</button>
          } @else {
            <span class="reaction-loading" role="status">{{ 'chat.shareLoading' | t }}</span>
          }
        </div>
      }
      @if (error) {
        <small role="alert" class="reaction-error">{{ 'chat.reactionError' | t }}</small>
      }
    </div>
  `,
  styles: [`
    :host { display:block; min-width:0; }
    .chat-reactions { display:flex; flex-direction:column; align-items:flex-start;
      gap:7px; width:max-content; max-width:100%; font:inherit; }
    :host(.own-reaction) .chat-reactions { align-items:flex-end; }
    .reaction-badges { display:flex; flex-wrap:wrap; align-items:center; gap:5px; }
    button { font:inherit; cursor:pointer; }
    .reaction-count { display:inline-flex; align-items:center; gap:4px; white-space:nowrap;
      min-width:40px; min-height:27px; padding:3px 9px; border-radius:999px;
      background:#1b424a; color:#f1fffc; border:1px solid #5fa99a;
      font-size:.76rem; box-shadow:0 2px 10px rgba(0,12,19,.32); }
    .reaction-count.mine { background:#245d55; border-color:#69eac5; }
    .reaction-open { display:grid; place-items:center; width:29px;height:29px;
      border:1px solid #467b77;border-radius:50%;background:#173c46;
      color:#daf9ed; font-size:.92rem; }
    /* A compact inline tray: no floating oval, no wrapping the remove action
       into the same line as the emojis, and no overlap with adjacent bubbles. */
    .reaction-picker { position:relative; z-index:1; display:flex;
      flex-direction:column; gap:5px; width:max-content; max-width:100%;
      padding:6px; border:1px solid #487d7b; border-radius:15px;
      background:#183a46; box-shadow:0 5px 18px rgba(0,10,20,.26); }
    .reaction-choices { display:grid; grid-template-columns:repeat(6,36px);
      gap:3px; max-width:100%; }
    .reaction-choice { display:grid; place-items:center; width:36px;height:36px;
      padding:0; border:0; border-radius:10px; background:transparent;
      font-size:1.13rem; line-height:1; }
    .reaction-choice[aria-pressed="true"] {background:#276a5d;}
    .reaction-choice:hover {background:#316b65;}
    .reaction-picker-footer {display:flex;justify-content:flex-end;align-items:center;
      border-top:1px solid rgba(146,217,205,.16);padding-top:4px;}
    .reaction-remove {display:inline-flex;align-items:center;gap:5px;
      min-height:29px;padding:3px 8px;border:0;border-radius:8px;
      background:transparent;color:#cce8e3;font-size:.72rem;line-height:1.2;}
    .reaction-remove span {font-size:1.15rem;line-height:1;}
    .reaction-remove:hover {background:#244e56;color:#ffffff;}
    .reaction-retry {border:1px solid #628e8a;border-radius:9px;
      background:#25505a;color:#e5f7f4;padding:6px 9px;font-size:.75rem;}
    .reaction-loading,.reaction-load-error {color:#d6f8ee;font-size:.75rem;padding:5px;}
    button:focus-visible {outline:2px solid #61edce;outline-offset:2px;}
    button:disabled {opacity:.45;cursor:not-allowed;}
    .reaction-error {color:#ffd2cd;font-size:.75rem;width:100%;}
    .sr-only {position:absolute;width:1px;height:1px;padding:0;margin:-1px;
      overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;}
    @media(max-width:380px) {
      .reaction-picker {padding:5px;}
      .reaction-choices {grid-template-columns:repeat(6,34px);gap:2px;}
      .reaction-choice {width:34px;height:36px;}
    }
  `]
})
export class ChatReactionsComponent implements OnInit, OnChanges, OnDestroy {
  @Input() kind!: ChatReactionKind;
  @Input() conversationId!: string | number;
  @Input() messageId!: number;
  @Input() disabled = false;
  @ViewChild('reactionToggle') private reactionToggle?: ElementRef<HTMLButtonElement>;
  readonly emojis = CHAT_REACTION_EMOJIS;
  // Instance-local ID avoids duplicate aria-controls even for repeated messages.
  readonly pickerId = 'chat-reactions-' + ++reactionPickerSequence;
  expanded = false;
  error = false;
  private watching?: { kind: ChatReactionKind; id: string | number; messageId: number };
  private reactionUpdates?: Subscription;
  private pickerTrigger?: HTMLElement;

  constructor(
    public readonly store: ChatReactionStoreService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // The store uses ordinary mutable Maps, not Angular signals. Without a
    // notification, the host can know that counts exist while its @for template
    // stays stuck displaying only the empty reaction button (Chromium QA).
    // Render immediately on each HTTP / WebSocket state change. The first
    // BehaviorSubject emission happens during ngOnInit and is ignored to avoid
    // re-entrant initial template rendering.
    this.reactionUpdates = this.store.changed.pipe(skip(1))
      .subscribe(() => this.cdr.detectChanges());
    this.watchCurrent();
  }
  ngOnChanges(): void { this.watchCurrent(); }
  ngOnDestroy(): void {
    this.reactionUpdates?.unsubscribe();
    this.stopWatching();
  }

  get summary(): ChatReactionSummary | undefined {
    return this.store.get(this.kind, this.conversationId, this.messageId);
  }
  get entries(): { emoji: string; count: number }[] {
    return this.emojis.filter(emoji => (this.summary?.counts?.[emoji] || 0) > 0)
      .map(emoji => ({ emoji, count: this.summary?.counts[emoji] || 0 }));
  }

  /** Close by Escape and return keyboard users to the same action. */
  dismissPicker(event: Event): void {
    if (!this.expanded) return;
    event.preventDefault();
    event.stopPropagation();
    this.expanded = false;
    (this.pickerTrigger ?? this.reactionToggle?.nativeElement)?.focus({ preventScroll: true });
  }

  /** Tab or click outside leaves no lingering open picker in another chat. */
  onFocusOut(event: FocusEvent): void {
    if (!this.expanded) return;
    const wrapper = event.currentTarget as HTMLElement | null;
    const next = event.relatedTarget as Node | null;
    if (!wrapper || !next || !wrapper.contains(next)) this.expanded = false;
  }

  togglePicker(event?: Event): void {
    this.expanded = !this.expanded;
    if (this.expanded) {
      this.pickerTrigger = (event?.currentTarget as HTMLElement | null)
        ?? this.reactionToggle?.nativeElement;
    }
    if (this.expanded && this.store.hasFailed(this.kind, this.conversationId, this.messageId)) {
      this.retry();
    }
  }

  retry(): void {
    this.store.retry(this.kind, this.conversationId, this.messageId);
  }

  pick(emoji: string): void {
    if (this.disabled || !this.summary) return;
    // Re-selecting an existing emoji must never silently erase it.
    // Removal is a separately labelled action in the picker.
    if (this.summary.myEmoji === emoji) {
      this.expanded = false;
      return;
    }
    this.error = false;
    this.expanded = false;
    this.store.toggle(this.kind, this.conversationId, this.messageId, emoji,
      () => { this.error = true; });
  }

  remove(): void {
    const selected = this.summary?.myEmoji;
    if (this.disabled || !selected) return;
    this.error = false;
    this.expanded = false;
    this.store.toggle(this.kind, this.conversationId, this.messageId, selected,
      () => { this.error = true; });
  }

  private watchCurrent(): void {
    if (!this.kind || this.conversationId === undefined || !this.messageId) return;
    if (this.watching?.kind === this.kind
        && String(this.watching.id).toLowerCase() === String(this.conversationId).toLowerCase()
        && this.watching.messageId === this.messageId) return;
    this.stopWatching();
    this.watching = { kind: this.kind, id: this.conversationId, messageId: this.messageId };
    this.store.watch(this.kind, this.conversationId, this.messageId);
    this.expanded = false;
    this.pickerTrigger = undefined;
    this.error = false;
  }

  private stopWatching(): void {
    if (this.watching) {
      this.store.unwatch(this.watching.kind, this.watching.id, this.watching.messageId);
      this.watching = undefined;
    }
  }
}
