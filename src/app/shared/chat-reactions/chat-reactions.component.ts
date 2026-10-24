import { CommonModule } from '@angular/common';
import { Component, ElementRef, Input, OnChanges, OnDestroy, OnInit, ViewChild } from '@angular/core';
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
  template: `
    @if (summary; as state) {
      <div class="chat-reactions" (keydown.escape)="dismissPicker($event)" (focusout)="onFocusOut($event)">
        @for (entry of entries; track entry.emoji) {
          <button type="button" class="reaction-count"
              [class.mine]="state.myEmoji === entry.emoji"
              [disabled]="disabled || store.isBusy(kind, conversationId, messageId)"
              [attr.aria-label]="entry.emoji + ' · ' + entry.count"
              [attr.aria-pressed]="state.myEmoji === entry.emoji"
              (click)="pick(entry.emoji)">
            {{ entry.emoji }} <span>{{ entry.count }}</span>
          </button>
        }
        @if (!disabled) {
          <button #reactionToggle type="button" class="reaction-open"
              [attr.aria-expanded]="expanded" [attr.aria-controls]="pickerId"
              [attr.aria-label]="'chat.react' | t"
              [disabled]="store.isBusy(kind, conversationId, messageId)"
              (click)="expanded = !expanded">
            <span aria-hidden="true">☺</span><span class="sr-only">{{ 'chat.react' | t }}</span>
          </button>
        }
        @if (expanded && !disabled) {
          <div [id]="pickerId" class="reaction-picker" role="group" [attr.aria-label]="'chat.react' | t">
            @for (emoji of emojis; track emoji) {
              <button type="button" [attr.aria-label]="emoji"
                [attr.aria-pressed]="state.myEmoji === emoji"
                [disabled]="store.isBusy(kind, conversationId, messageId)"
                (click)="pick(emoji)">{{ emoji }}</button>
            }
          </div>
        }
        @if (error) {
          <small role="alert" class="reaction-error">{{ 'chat.reactionError' | t }}</small>
        }
      </div>
    }
  `,
  styles: [`
    :host { display: block; min-width: 0; }
    .chat-reactions { display: flex; flex-wrap: wrap; position: relative; align-items: center;
      gap: 5px; margin-top: 7px; font: inherit; }
    button { font: inherit; cursor: pointer; }
    .reaction-count { background: rgba(8,34,45,.45); color: #e3faf6;
      border: 1px solid rgba(143,217,208,.24); border-radius: 999px;
      padding: 3px 8px; font-size: .76rem; white-space: nowrap; }
    .reaction-count.mine { background: rgba(49,211,172,.19); border-color: #4ee6be; }
    .reaction-open { width: 26px; height: 26px; border: 1px solid rgba(143,217,208,.25);
      border-radius: 50%; background: rgba(12,42,53,.45); color: #aff0dc; font-size: 1rem; }
    .reaction-picker { display: flex; flex-wrap: wrap; gap: 2px; padding: 6px;
      background: #193847; border: 1px solid #48777c; border-radius: 12px; z-index: 2; }
    .reaction-picker button { border: 0; background: transparent; border-radius: 7px;
      padding: 4px; font-size: 1.08rem; }
    .reaction-picker button:hover { background: rgba(82,217,187,.16); }
    .reaction-picker button:focus-visible { background: rgba(82,217,187,.20); }
    button:focus-visible { outline: 2px solid #61edce; outline-offset: 2px; }
    button:disabled { opacity: .45; cursor: not-allowed; }
    .reaction-error { color: #ffd2cd; font-size: .75rem; width: 100%; }
    .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
      overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
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

  constructor(public readonly store: ChatReactionStoreService) {}

  ngOnInit(): void { this.watchCurrent(); }
  ngOnChanges(): void { this.watchCurrent(); }
  ngOnDestroy(): void { this.stopWatching(); }

  get summary(): ChatReactionSummary | undefined {
    return this.store.get(this.kind, this.conversationId, this.messageId);
  }
  get entries(): { emoji: string; count: number }[] {
    return this.emojis.filter(emoji => (this.summary?.counts?.[emoji] || 0) > 0)
      .map(emoji => ({ emoji, count: this.summary?.counts[emoji] || 0 }));
  }

  /** Close by Escape and return keyboard users to the same action. */
  dismissPicker(event: KeyboardEvent): void {
    if (!this.expanded) return;
    event.preventDefault();
    event.stopPropagation();
    this.expanded = false;
    this.reactionToggle?.nativeElement.focus({ preventScroll: true });
  }

  /** Tab or click outside leaves no lingering open picker in another chat. */
  onFocusOut(event: FocusEvent): void {
    if (!this.expanded) return;
    const wrapper = event.currentTarget as HTMLElement | null;
    const next = event.relatedTarget as Node | null;
    if (!wrapper || !next || !wrapper.contains(next)) this.expanded = false;
  }

  pick(emoji: string): void {
    if (this.disabled || !this.summary) return;
    this.error = false;
    this.expanded = false;
    this.store.toggle(this.kind, this.conversationId, this.messageId, emoji,
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
    this.error = false;
  }

  private stopWatching(): void {
    if (this.watching) {
      this.store.unwatch(this.watching.kind, this.watching.id, this.watching.messageId);
      this.watching = undefined;
    }
  }
}
