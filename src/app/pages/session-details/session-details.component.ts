import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { JwtHelperService } from '@auth0/angular-jwt';
import { finalize } from 'rxjs';

import { environment } from 'src/environment/environment';
import { SessionDetail } from '../model/session-detail';
import { SessionMessage } from '../model/session-message';
import { ReliabilitySummary } from '../model/reliability-summary';
import { SessionParticipant } from '../model/session-participant';
import { JoinSessionResponse, SessionService } from '../../services/session.service';
import { ReliabilityService } from '../../services/reliability.service';

@Component({
  selector: 'app-session-details',
  templateUrl: './session-details.component.html',
  styleUrls: ['./session-details.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false
})
export class SessionDetailsComponent implements OnInit {
  session?: SessionDetail;
  messages: SessionMessage[] = [];
  creatorReliability?: ReliabilitySummary;
  participants: SessionParticipant[] = [];

  loading = false;
  actionLoading = false;
  chatLoading = false;
  messageSending = false;
  reliabilityLoading = false;
  participantsLoading = false;
  attendanceUpdatingId: number | null = null;
  removeLoadingId: number | null = null;
  pendingRemovalId: number | null = null;

  errorMessage = '';
  actionError = '';
  actionSuccess = '';
  chatError = '';
  reliabilityError = '';
  attendanceError = '';
  attendanceSuccess = '';
  participantManagementError = '';
  participantManagementSuccess = '';

  joinPassword = '';
  messageBody = '';

  private sessionId?: number;
  private currentUsername: string | null = null;
  private readonly jwtHelper = new JwtHelperService();

  constructor(
    private route: ActivatedRoute,
    private sessionService: SessionService,
    private reliabilityService: ReliabilityService
  ) {}

  ngOnInit(): void {
    this.currentUsername = this.readCurrentUsername();

    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!Number.isFinite(id) || id <= 0) {
      this.errorMessage = 'Sessão inválida.';
      return;
    }

    this.sessionId = id;
    this.loadSession();
  }

  joinSession(): void {
    if (!this.session || !this.sessionId || this.actionLoading) {
      return;
    }

    if (this.session.privateGame && !this.joinPassword.trim()) {
      this.actionError = 'Esta sessão é privada. Introduz a palavra-passe.';
      this.actionSuccess = '';
      return;
    }

    this.actionLoading = true;
    this.actionError = '';
    this.actionSuccess = '';

    this.sessionService.join(this.sessionId, this.joinPassword)
      .pipe(finalize(() => this.actionLoading = false))
      .subscribe({
        next: response => {
          this.joinPassword = '';
          this.actionSuccess = this.joinSuccessMessage(response);
          this.loadSession(false);
        },
        error: error => {
          this.actionError = this.errorFrom(error, 'Não foi possível entrar nesta sessão.');
        }
      });
  }

  leaveSession(): void {
    if (!this.sessionId || this.actionLoading || this.isCreator()) {
      return;
    }

    const wasWaitlisted = Boolean(this.session?.waitlisted);

    this.actionLoading = true;
    this.actionError = '';
    this.actionSuccess = '';

    this.sessionService.leave(this.sessionId)
      .pipe(finalize(() => this.actionLoading = false))
      .subscribe({
        next: () => {
          this.actionSuccess = wasWaitlisted
            ? 'Saíste da lista de espera.'
            : 'Saíste da sessão.';
          this.loadSession(false);
        },
        error: error => {
          this.actionError = this.errorFrom(error, 'Não foi possível sair desta sessão.');
        }
      });
  }

  loadParticipants(): void {
    if (!this.sessionId || !this.isCreator() || this.participantsLoading) {
      return;
    }

    this.participantsLoading = true;
    this.attendanceError = '';

    this.sessionService.participants(this.sessionId)
      .pipe(finalize(() => this.participantsLoading = false))
      .subscribe({
        next: participants => this.participants = participants,
        error: error => {
          this.participants = [];
          this.attendanceError = this.errorFrom(
            error,
            'Não foi possível carregar os participantes desta sessão.'
          );
        }
      });
  }

  recordAttendance(participant: SessionParticipant, status: 'ATTENDED' | 'NO_SHOW'): void {
    if (!this.sessionId || !this.isCreator() || this.attendanceUpdatingId !== null) {
      return;
    }

    if (!this.canRecordAttendance()) {
      this.attendanceError = 'Só podes marcar presenças 30 minutos depois do início da sessão.';
      this.attendanceSuccess = '';
      return;
    }

    this.attendanceUpdatingId = participant.id;
    this.attendanceError = '';
    this.attendanceSuccess = '';

    this.reliabilityService.recordAttendance(this.sessionId, participant.id, status)
      .pipe(finalize(() => this.attendanceUpdatingId = null))
      .subscribe({
        next: () => {
          participant.attendanceStatus = status;
          this.attendanceSuccess = status === 'ATTENDED'
            ? `${participant.username} marcado como presente.`
            : `${participant.username} marcado como falta.`;
        },
        error: error => {
          this.attendanceError = this.errorFrom(
            error,
            'Não foi possível atualizar a presença. O backend pode exigir um pequeno período após o início da sessão.'
          );
        }
      });
  }

  canRemoveParticipant(participant: SessionParticipant): boolean {
    if (!this.session?.creatorUsername) {
      return false;
    }

    return participant.username.toLowerCase() !== this.session.creatorUsername.toLowerCase();
  }

  requestRemoveParticipant(participant: SessionParticipant): void {
    if (!this.canRemoveParticipant(participant) || this.removeLoadingId !== null) {
      return;
    }

    this.pendingRemovalId = participant.id;
    this.participantManagementError = '';
    this.participantManagementSuccess = '';
  }

  cancelRemoveParticipant(): void {
    if (this.removeLoadingId !== null) {
      return;
    }

    this.pendingRemovalId = null;
  }

  confirmRemoveParticipant(participant: SessionParticipant): void {
    if (
      !this.sessionId
      || !this.isCreator()
      || !this.canRemoveParticipant(participant)
      || this.removeLoadingId !== null
    ) {
      return;
    }

    this.removeLoadingId = participant.id;
    this.participantManagementError = '';
    this.participantManagementSuccess = '';

    this.sessionService.removeParticipant(this.sessionId, participant.id)
      .pipe(finalize(() => this.removeLoadingId = null))
      .subscribe({
        next: () => {
          this.pendingRemovalId = null;
          this.participantManagementSuccess =
            `${participant.username} foi removido da sessão.`;
          this.loadSession(false);
        },
        error: error => {
          this.participantManagementError = this.errorFrom(
            error,
            'Não foi possível remover este participante.'
          );
        }
      });
  }

  attendanceLabel(status: string): string {
    switch (status) {
      case 'ATTENDED':
        return 'Presente';
      case 'NO_SHOW':
        return 'Faltou';
      case 'LATE_CANCELLED':
        return 'Cancelou tarde';
      default:
        return 'Por marcar';
    }
  }

  canRecordAttendance(): boolean {
    if (!this.session?.gameDate) {
      return false;
    }

    const attendanceAvailableAt =
      new Date(this.session.gameDate).getTime() + (30 * 60 * 1000);

    return attendanceAvailableAt <= Date.now();
  }

  refreshMessages(): void {
    if (!this.sessionId || !this.canAccessChat() || this.chatLoading) {
      return;
    }

    this.chatLoading = true;
    this.chatError = '';

    this.sessionService.messages(this.sessionId)
      .pipe(finalize(() => this.chatLoading = false))
      .subscribe({
        next: messages => this.messages = messages,
        error: error => {
          this.chatError = this.errorFrom(error, 'Não foi possível carregar o chat desta sessão.');
        }
      });
  }

  sendMessage(): void {
    const body = this.messageBody.trim();

    if (!this.sessionId || !this.canAccessChat() || this.messageSending) {
      return;
    }

    if (!body) {
      this.chatError = 'Escreve uma mensagem antes de enviar.';
      return;
    }

    if (body.length > 2000) {
      this.chatError = 'A mensagem não pode ter mais de 2000 caracteres.';
      return;
    }

    this.messageSending = true;
    this.chatError = '';

    this.sessionService.postMessage(this.sessionId, body)
      .pipe(finalize(() => this.messageSending = false))
      .subscribe({
        next: message => {
          this.messages = [...this.messages, message];
          this.messageBody = '';
        },
        error: error => {
          this.chatError = this.errorFrom(error, 'Não foi possível enviar a mensagem.');
        }
      });
  }

  canAccessChat(): boolean {
    return Boolean(this.session?.joined);
  }

  isOwnMessage(message: SessionMessage): boolean {
    return Boolean(
      this.currentUsername
      && message.senderUsername.toLowerCase() === this.currentUsername.toLowerCase()
    );
  }

  isCreator(): boolean {
    if (!this.session?.creatorUsername || !this.currentUsername) {
      return false;
    }

    return this.session.creatorUsername.toLowerCase() === this.currentUsername.toLowerCase();
  }

  isFull(): boolean {
    if (!this.session) {
      return false;
    }

    return this.session.maxParticipants > 0
      && this.session.participantCount >= this.session.maxParticipants;
  }

  joinButtonLabel(): string {
    if (this.actionLoading) {
      return 'A processar...';
    }

    return this.isFull() ? 'Entrar na lista de espera' : 'Juntar-me à sessão';
  }

  photoUrl(path: string | null): string | null {
    if (!path) {
      return null;
    }
    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
      return path;
    }
    return environment.apiUrl + (path.startsWith('/') ? path : '/' + path);
  }

  private loadSession(showPageLoader = true): void {
    if (!this.sessionId) {
      return;
    }

    if (showPageLoader) {
      this.loading = true;
    }
    this.errorMessage = '';

    this.sessionService.detail(this.sessionId)
      .pipe(finalize(() => {
        if (showPageLoader) {
          this.loading = false;
        }
      }))
      .subscribe({
        next: session => {
          this.session = session;

          if (session.creatorUsername) {
            this.loadCreatorReliability(session.creatorUsername);
          }

          if (this.isCreator()) {
            this.loadParticipants();
          } else {
            this.participants = [];
          }

          if (session.joined) {
            this.refreshMessages();
          } else {
            this.messages = [];
            this.chatError = '';
          }
        },
        error: () => this.errorMessage = 'Não foi possível carregar os detalhes desta sessão.'
      });
  }

  private loadCreatorReliability(username: string): void {
    this.reliabilityLoading = true;
    this.reliabilityError = '';

    this.reliabilityService.summary(username)
      .pipe(finalize(() => this.reliabilityLoading = false))
      .subscribe({
        next: summary => this.creatorReliability = summary,
        error: () => {
          this.creatorReliability = undefined;
          this.reliabilityError = 'Não foi possível carregar a fiabilidade deste utilizador.';
        }
      });
  }

  private joinSuccessMessage(response: JoinSessionResponse): string {
    if (response.state === 'WAITLISTED') {
      return response.waitlistPosition
        ? `A sessão está cheia. Ficaste na posição ${response.waitlistPosition} da lista de espera.`
        : 'A sessão está cheia. Foste adicionado à lista de espera.';
    }

    return 'Entraste na sessão com sucesso.';
  }

  private errorFrom(error: HttpErrorResponse, fallback: string): string {
    const apiMessage = error.error?.message;
    return typeof apiMessage === 'string' && apiMessage.trim()
      ? apiMessage
      : fallback;
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
}
