import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { JwtHelperService } from '@auth0/angular-jwt';
import { finalize } from 'rxjs';

import { environment } from 'src/environment/environment';
import { SessionDetail } from '../model/session-detail';
import { JoinSessionResponse, SessionService } from '../../services/session.service';

@Component({
  selector: 'app-session-details',
  templateUrl: './session-details.component.html',
  styleUrls: ['./session-details.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false
})
export class SessionDetailsComponent implements OnInit {
  session?: SessionDetail;
  loading = false;
  actionLoading = false;
  errorMessage = '';
  actionError = '';
  actionSuccess = '';
  joinPassword = '';

  private sessionId?: number;
  private currentUsername: string | null = null;
  private readonly jwtHelper = new JwtHelperService();

  constructor(
    private route: ActivatedRoute,
    private sessionService: SessionService
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

    this.actionLoading = true;
    this.actionError = '';
    this.actionSuccess = '';

    this.sessionService.leave(this.sessionId)
      .pipe(finalize(() => this.actionLoading = false))
      .subscribe({
        next: () => {
          this.actionSuccess = 'Saíste da sessão.';
          this.loadSession(false);
        },
        error: error => {
          this.actionError = this.errorFrom(error, 'Não foi possível sair desta sessão.');
        }
      });
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
        next: session => this.session = session,
        error: () => this.errorMessage = 'Não foi possível carregar os detalhes desta sessão.'
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
