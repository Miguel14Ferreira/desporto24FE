import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { finalize } from 'rxjs';

import { AttendanceHistoryItem } from '../model/attendance-history';
import { MySessionsResponse } from '../model/my-sessions-response';
import { SessionSummary } from '../model/session-summary';
import { ReliabilityService } from '../../services/reliability.service';
import { SessionService } from '../../services/session.service';

@Component({
  selector: 'app-my-sessions',
  templateUrl: './my-sessions.component.html',
  styleUrls: ['./my-sessions.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false
})
export class MySessionsComponent implements OnInit {
  data: MySessionsResponse = {
    created: [],
    joined: [],
    waitlisted: []
  };

  attendanceHistory: AttendanceHistoryItem[] = [];

  loading = false;
  attendanceLoading = false;
  cancelLoading = false;
  disputeLoading = false;

  errorMessage = '';
  attendanceError = '';
  actionMessage = '';
  actionError = '';

  pendingCancelId: number | null = null;
  pendingDispute?: AttendanceHistoryItem;
  disputeReason = '';

  constructor(
    private sessionService: SessionService,
    private reliabilityService: ReliabilityService
  ) {}

  ngOnInit(): void {
    this.load();
    this.loadAttendanceHistory();
  }

  load(): void {
    this.loading = true;
    this.errorMessage = '';

    this.sessionService.mine()
      .pipe(finalize(() => this.loading = false))
      .subscribe({
        next: data => this.data = data,
        error: () => this.errorMessage = 'Não foi possível carregar as tuas sessões.'
      });
  }

  loadAttendanceHistory(): void {
    this.attendanceLoading = true;
    this.attendanceError = '';

    this.reliabilityService.attendanceHistory()
      .pipe(finalize(() => this.attendanceLoading = false))
      .subscribe({
        next: history => this.attendanceHistory = history,
        error: () => {
          this.attendanceHistory = [];
          this.attendanceError = 'Não foi possível carregar o histórico de presenças.';
        }
      });
  }

  requestCancel(session: SessionSummary): void {
    if (!this.canCancel(session) || this.cancelLoading) {
      return;
    }

    this.pendingCancelId = session.id;
    this.actionMessage = '';
    this.actionError = '';
  }

  dismissCancel(): void {
    if (this.cancelLoading) {
      return;
    }

    this.pendingCancelId = null;
  }

  confirmCancel(): void {
    if (this.pendingCancelId === null || this.cancelLoading) {
      return;
    }

    const sessionId = this.pendingCancelId;
    this.cancelLoading = true;
    this.actionMessage = '';
    this.actionError = '';

    this.sessionService.cancel(sessionId)
      .pipe(finalize(() => this.cancelLoading = false))
      .subscribe({
        next: () => {
          this.pendingCancelId = null;
          this.actionMessage = 'Sessão cancelada com sucesso.';
          this.load();
        },
        error: error => {
          this.actionError = this.errorFrom(error, 'Não foi possível cancelar esta sessão.');
        }
      });
  }

  requestDispute(item: AttendanceHistoryItem): void {
    if (!item.canDispute || this.disputeLoading) {
      return;
    }

    this.pendingDispute = item;
    this.disputeReason = '';
    this.actionMessage = '';
    this.actionError = '';
  }

  dismissDispute(): void {
    if (this.disputeLoading) {
      return;
    }

    this.pendingDispute = undefined;
    this.disputeReason = '';
  }

  confirmDispute(): void {
    const reason = this.disputeReason.trim();

    if (!this.pendingDispute || this.disputeLoading) {
      return;
    }

    if (!reason) {
      this.actionError = 'Explica por que motivo queres contestar esta falta.';
      return;
    }

    if (reason.length > 2000) {
      this.actionError = 'A justificação não pode ter mais de 2000 caracteres.';
      return;
    }

    const participantId = this.pendingDispute.participantId;
    this.disputeLoading = true;
    this.actionMessage = '';
    this.actionError = '';

    this.reliabilityService.createDispute(participantId, reason)
      .pipe(finalize(() => this.disputeLoading = false))
      .subscribe({
        next: () => {
          this.attendanceHistory = this.attendanceHistory.map(item =>
            item.participantId === participantId
              ? { ...item, disputeStatus: 'OPEN', canDispute: false }
              : item
          );
          this.pendingDispute = undefined;
          this.disputeReason = '';
          this.actionMessage = 'Contestação enviada. O estado fica agora em análise.';
        },
        error: error => {
          this.actionError = this.errorFrom(
            error,
            'Não foi possível enviar a contestação.'
          );
        }
      });
  }

  canCancel(session: SessionSummary): boolean {
    return session.status !== 'CANCELLED' && session.status !== 'COMPLETED';
  }

  vacancies(session: SessionSummary): number {
    return Math.max(session.maxParticipants - session.participantCount, 0);
  }

  attendanceLabel(item: AttendanceHistoryItem): string {
    switch (item.attendanceStatus) {
      case 'ATTENDED':
        return 'Presente';
      case 'NO_SHOW':
        return 'Faltou';
      case 'LATE_CANCELLED':
        return 'Cancelamento tardio';
      default:
        return 'Pendente';
    }
  }

  disputeLabel(item: AttendanceHistoryItem): string {
    switch (item.disputeStatus) {
      case 'OPEN':
        return 'Em análise';
      case 'ACCEPTED':
        return 'Aceite';
      case 'REJECTED':
        return 'Rejeitada';
      default:
        return '';
    }
  }

  private errorFrom(error: HttpErrorResponse, fallback: string): string {
    const apiMessage = error.error?.message;
    return typeof apiMessage === 'string' && apiMessage.trim()
      ? apiMessage
      : fallback;
  }
}
