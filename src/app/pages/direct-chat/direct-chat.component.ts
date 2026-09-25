import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { JwtHelperService } from '@auth0/angular-jwt';
import { forkJoin, finalize } from 'rxjs';

import { DirectChatInfo, DirectChatMessage } from '../model/direct-chat';
import { DirectChatService } from '../../services/direct-chat.service';
import { CommunityService } from '../../services/community.service';

@Component({
  selector: 'app-direct-chat',
  templateUrl: './direct-chat.component.html',
  styleUrls: ['./direct-chat.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false
})
export class DirectChatComponent implements OnInit {
  recipientUsername = '';
  currentUsername: string | null = null;
  messages: DirectChatMessage[] = [];
  chatInfo?: DirectChatInfo;

  loading = false;
  sending = false;
  friendshipActionLoading = false;
  errorMessage = '';
  actionError = '';
  actionSuccess = '';
  messageBody = '';

  private readonly jwtHelper = new JwtHelperService();

  constructor(
    private route: ActivatedRoute,
    private chatService: DirectChatService,
    private communityService: CommunityService
  ) {}

  ngOnInit(): void {
    this.currentUsername = this.readCurrentUsername();
    this.recipientUsername = this.resolveRecipient();

    if (!this.recipientUsername) {
      this.errorMessage = 'Conversa inválida.';
      return;
    }

    this.load();
  }

  load(): void {
    if (!this.recipientUsername) {
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    forkJoin({
      messages: this.chatService.history(this.recipientUsername),
      info: this.chatService.info(this.recipientUsername)
    })
      .pipe(finalize(() => this.loading = false))
      .subscribe({
        next: result => {
          this.messages = [...result.messages].sort(
            (a, b) => this.timestamp(a) - this.timestamp(b)
          );
          this.chatInfo = result.info;
        },
        error: error => {
          this.messages = [];
          this.errorMessage = this.errorFrom(
            error,
            'Não foi possível carregar esta conversa.'
          );
        }
      });
  }

  sendMessage(): void {
    const text = this.messageBody.trim();

    if (!this.recipientUsername || this.sending || this.chatInfo?.chatBlocked) {
      return;
    }

    if (!text) {
      this.actionError = 'Escreve uma mensagem antes de enviar.';
      return;
    }

    if (text.length > 2000) {
      this.actionError = 'A mensagem não pode ter mais de 2000 caracteres.';
      return;
    }

    this.sending = true;
    this.actionError = '';
    this.actionSuccess = '';

    this.chatService.send(this.recipientUsername, text)
      .pipe(finalize(() => this.sending = false))
      .subscribe({
        next: message => {
          this.messages = [...this.messages, message];
          this.messageBody = '';
        },
        error: error => {
          this.actionError = this.errorFrom(
            error,
            'Não foi possível enviar a mensagem.'
          );
        }
      });
  }

  isOwnMessage(message: DirectChatMessage): boolean {
    return Boolean(
      this.currentUsername
      && message.username1.toLowerCase() === this.currentUsername.toLowerCase()
    );
  }

  isBlockedByMe(): boolean {
    return Boolean(
      this.chatInfo?.chatBlocked
      && this.currentUsername
      && this.chatInfo.whoBlocked?.toLowerCase() === this.currentUsername.toLowerCase()
    );
  }

  toggleChatBlock(): void {
    if (!this.recipientUsername || this.friendshipActionLoading) {
      return;
    }

    if (this.chatInfo?.chatBlocked && !this.isBlockedByMe()) {
      this.actionError = 'Este chat foi bloqueado pelo outro utilizador.';
      this.actionSuccess = '';
      return;
    }

    const shouldUnblock = this.isBlockedByMe();
    const request$ = shouldUnblock
      ? this.communityService.unblockFriend(this.recipientUsername)
      : this.communityService.blockFriend(this.recipientUsername);

    this.friendshipActionLoading = true;
    this.actionError = '';
    this.actionSuccess = '';

    request$
      .pipe(finalize(() => this.friendshipActionLoading = false))
      .subscribe({
        next: () => {
          this.chatInfo = shouldUnblock
            ? { chatBlocked: false, whoBlocked: null }
            : { chatBlocked: true, whoBlocked: this.currentUsername };
          this.actionSuccess = shouldUnblock
            ? 'Chat desbloqueado.'
            : 'Chat bloqueado.';
        },
        error: error => {
          this.actionError = this.errorFrom(
            error,
            shouldUnblock
              ? 'Não foi possível desbloquear este chat.'
              : 'Não foi possível bloquear este chat.'
          );
        }
      });
  }

  blockedMessage(): string {
    if (!this.chatInfo?.chatBlocked) {
      return '';
    }

    if (this.isBlockedByMe()) {
      return 'Bloqueaste este chat.';
    }

    return 'Este chat está bloqueado.';
  }

  messageDate(message: DirectChatMessage): string {
    const raw = message.date || message.dataDisplay;
    if (!raw) {
      return '';
    }

    const parsed = Date.parse(raw);
    if (Number.isNaN(parsed)) {
      return raw;
    }

    return new Intl.DateTimeFormat('pt-PT', {
      dateStyle: 'short',
      timeStyle: 'short'
    }).format(new Date(parsed));
  }

  private resolveRecipient(): string {
    const direct = this.route.snapshot.paramMap.get('username');
    if (direct) {
      return direct;
    }

    const username1 = this.route.snapshot.paramMap.get('username1');
    const username2 = this.route.snapshot.paramMap.get('username2');

    if (!username1 || !username2) {
      return '';
    }

    if (this.currentUsername?.toLowerCase() === username1.toLowerCase()) {
      return username2;
    }

    if (this.currentUsername?.toLowerCase() === username2.toLowerCase()) {
      return username1;
    }

    return username2;
  }

  private timestamp(message: DirectChatMessage): number {
    const raw = message.date || message.dataDisplay;
    if (!raw) {
      return 0;
    }

    const parsed = Date.parse(raw);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  private readCurrentUsername(): string | null {
    const token = localStorage.getItem('t');
    if (!token) {
      return null;
    }

    try {
      return this.jwtHelper.decodeToken(token)?.sub ?? null;
    } catch {
      return null;
    }
  }

  private errorFrom(error: HttpErrorResponse, fallback: string): string {
    const apiMessage = error.error?.message;
    return typeof apiMessage === 'string' && apiMessage.trim()
      ? apiMessage
      : fallback;
  }
}
