import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { finalize } from 'rxjs';

import { MySessionsResponse } from '../model/my-sessions-response';
import { SessionSummary } from '../model/session-summary';
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

  loading = false;
  cancelLoading = false;
  errorMessage = '';
  actionMessage = '';
  actionError = '';
  pendingCancelId: number | null = null;

  constructor(private sessionService: SessionService) {}

  ngOnInit(): void {
    this.load();
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

  canCancel(session: SessionSummary): boolean {
    return session.status !== 'CANCELLED' && session.status !== 'COMPLETED';
  }

  vacancies(session: SessionSummary): number {
    return Math.max(session.maxParticipants - session.participantCount, 0);
  }

  private errorFrom(error: HttpErrorResponse, fallback: string): string {
    const apiMessage = error.error?.message;
    return typeof apiMessage === 'string' && apiMessage.trim()
      ? apiMessage
      : fallback;
  }
}
