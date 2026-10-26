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
    <div class="chat-reactions" (keydown.escape)="dismissPicker($event)" (focusout)="onFocusOut($event)">
      @for (entry of entries; track entry.emoji) {
        <button type="button" class="reaction-count"
            [class.mine]="summary?.myEmoji === entry.emoji"
            [disabled]="disabled || store.isBusy(kind, conversationId, messageId)"
            [attr.aria-label]="('chat.changeReaction' | t) + ': ' + entry.emoji + ' · ' + entry.count"
            [attr.aria-pressed]="summary?.myEmoji === entry.emoji"
            (click)="togglePicker()">
          {{ entry.emoji }} <span>{{ entry.count }}</span>
        </button>
      }
      @if (!disabled) {
        <button #reactionToggle type="button" class="reaction-open"
            [class.reaction-open--with-counts]="entries.length > 0"
            [attr.aria-expanded]="expanded" [attr.aria-controls]="pickerId"
            [attr.aria-label]="'chat.react' | t"
            [disabled]="store.isBusy(kind, conversationId, messageId)"
            (click)="togglePicker()">
          <span aria-hidden="true">😊</span><span class="sr-only">{{ 'chat.react' | t }}</span>
        </button>
      }
      @if (expanded && !disabled) {
        <div [id]="pickerId" class="reaction-picker" role="group" [attr.aria-label]="'chat.react' | t">
          @if (summary; as state) {
            @for (emoji of emojis; track emoji) {
              <button type="button" [attr.aria-label]="emoji"
                [attr.aria-pressed]="state.myEmoji === emoji"
                [disabled]="store.isBusy(kind, conversationId, messageId)"
                (click)="pick(emoji)">{{ emoji }}</button>
            }
            @if (state.myEmoji) {
              <button type="button" class="reaction-remove"
                [disabled]="store.isBusy(kind, conversationId, messageId)"
                (click)="remove()">{{ 'chat.removeReaction' | t }}</button>
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
    :host { display: block; min-width: 0; }
    .chat-reactions { display: flex; position:relative; align-items:center; gap:5px;
      max-width:100%; font:inherit; }
    button { font: inherit; cursor:pointer; }
    .reaction-count { background:#1b424a;color:#f1fffc;
      border:1px solid #5fa99a;border-radius:999px;
      padding:3px 9px;min-width:40px;min-height:26px;font-size:.76rem;
      display:inline-flex;align-items:center;gap:4px;white-space:nowrap;
      box-shadow:0 2px 10px rgba(0,12,19,.35); }
    .reaction-count.mine { background:#245d55;border-color:#69eac5; }
    .reaction-open { width:27px;height:27px;border:1px solid #467b77;
      border-radius:50%;background:#173c46;color:#daf9ed;font-size:.86rem;
      display:grid;place-items:center;box-shadow:0 2px 10px rgba(0,12,19,.3); }
    .reaction-open--with-counts:not(:focus-visible) { opacity:.75; }
    .reaction-picker { position:absolute;bottom:calc(100% + 8px);left:0;
      display:flex;flex-wrap:wrap;gap:3px;padding:6px;align-items:center;
      width:max-content;max-width:min(330px,calc(100vw - 50px));
      background:#193847;border:1px solid #5b9e91;border-radius:999px;
      box-shadow:0 12px 36px rgba(0,7,16,.5);z-index:50; }
    :host-context(.is-mine) .reaction-picker,
    :host-context(.own-message) .reaction-picker {left:auto;right:0;}
    .reaction-picker button { border:0;background:transparent;border-radius:999px;
      padding:5px;font-size:1.16rem;min-width:34px;min-height:34px;line-height:1; }
    .reaction-picker button[aria-pressed="true"] { background:#276a5d; }
    .reaction-picker button:hover {background:#316b65;transform:translateY(-1px);}
    .reaction-picker button:focus-visible {background:#316b65;}
    .reaction-picker .reaction-remove,.reaction-picker .reaction-retry {
      border:1px solid #628e8a;padding:6px 10px;min-width:0;min-height:32px;
      font-size:.72rem;line-height:1.2;color:#e5f7f4;
      background:#25505a;white-space:nowrap; }
    .reaction-loading,.reaction-load-error {color:#d6f8ee;font-size:.75rem;padding:5px;}
    @media(max-width:500px) {
      .reaction-picker {border-radius:16px;max-width:min(275px,calc(100vw - 28px));}
      .reaction-picker button {min-height:37px;min-width:37px;}
    }
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
  dismissPicker(event: Event): void {
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

  togglePicker(): void {
    this.expanded = !this.expanded;
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
    this.error = false;
  }

  private stopWatching(): void {
    if (this.watching) {
      this.store.unwatch(this.watching.kind, this.watching.id, this.watching.messageId);
      this.watching = undefined;
    }
  }
}
