import { Component, Input } from '@angular/core';
import { ChatReactionKind } from '../services/chat-reaction-store.service';

/** Keep existing parent-component regressions isolated from reaction API calls. */
@Component({ selector: 'app-chat-reactions', standalone: true, template: '' })
export class ChatReactionsStubComponent {
  @Input() kind!: ChatReactionKind;
  @Input() conversationId!: string | number;
  @Input() messageId!: number;
  @Input() disabled = false;
}
