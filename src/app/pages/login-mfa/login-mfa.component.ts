import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';

import { AuthenticationService } from '../../services/authethication.service';

@Component({
  selector: 'app-login-mfa',
  templateUrl: './login-mfa.component.html',
  styleUrls: ['./login-mfa.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false
})
export class LoginMFAComponent implements OnInit, OnDestroy {
  code = '';
  challengeId = '';
  expiresAt = '';

  confirming = false;
  resending = false;
  errorMessage = '';
  successMessage = '';
  remainingSeconds: number | null = null;

  private countdownTimer?: ReturnType<typeof setInterval>;

  constructor(
    private authService: AuthenticationService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.challengeId = sessionStorage.getItem('mfa-challenge-id') || '';
    this.expiresAt = sessionStorage.getItem('mfa-expires-at') || '';

    if (!this.challengeId) {
      this.errorMessage = 'O desafio MFA já não está disponível. Inicia sessão novamente.';
      return;
    }

    this.startCountdown();
  }

  ngOnDestroy(): void {
    this.stopCountdown();
  }

  confirmCode(): void {
    const code = this.code.trim();

    if (!this.challengeId) {
      this.errorMessage = 'O desafio MFA expirou. Inicia sessão novamente.';
      return;
    }

    if (this.isChallengeExpired()) {
      this.errorMessage = 'O código MFA expirou. Reenvia o código para continuar.';
      this.successMessage = '';
      return;
    }

    if (!code) {
      this.errorMessage = 'Introduz o código recebido por SMS.';
      return;
    }

    if (this.confirming) {
      return;
    }

    this.confirming = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.authService.confirmMfaChallenge(this.challengeId, code)
      .pipe(finalize(() => this.confirming = false))
      .subscribe({
        next: response => {
          if (!response.token) {
            this.errorMessage = 'O servidor não devolveu um token de autenticação.';
            return;
          }

          this.authService.saveToken(response.token);
          const returnUrl = sessionStorage.getItem('mfa-return-url') || '/menu';
          this.clearChallenge();
          this.router.navigateByUrl(returnUrl);
        },
        error: error => {
          this.errorMessage = this.errorFrom(
            error,
            'Código inválido ou expirado.'
          );
        }
      });
  }

  resendCode(): void {
    if (!this.challengeId || this.resending) {
      return;
    }

    this.resending = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.authService.resendMfaChallenge(this.challengeId)
      .pipe(finalize(() => this.resending = false))
      .subscribe({
        next: response => {
          if (!response.challengeId) {
            this.errorMessage = 'Não foi possível criar um novo desafio MFA.';
            return;
          }

          this.challengeId = response.challengeId;
          sessionStorage.setItem('mfa-challenge-id', response.challengeId);

          if (response.expiresAt) {
            this.expiresAt = response.expiresAt;
            sessionStorage.setItem('mfa-expires-at', response.expiresAt);
            this.startCountdown();
          } else {
            this.expiresAt = '';
            this.remainingSeconds = null;
            sessionStorage.removeItem('mfa-expires-at');
            this.stopCountdown();
          }

          this.successMessage = 'Foi enviado um novo código por SMS.';
        },
        error: error => {
          this.errorMessage = this.errorFrom(
            error,
            'Não foi possível reenviar o código.'
          );
        }
      });
  }

  cancel(): void {
    this.clearChallenge();
    this.router.navigate(['/login']);
  }

  countdownLabel(): string {
    if (this.remainingSeconds === null) {
      return '';
    }

    const minutes = Math.floor(this.remainingSeconds / 60);
    const seconds = this.remainingSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  isChallengeExpired(): boolean {
    if (!this.expiresAt) {
      return false;
    }

    const parsed = Date.parse(this.expiresAt);
    return !Number.isNaN(parsed) && parsed <= Date.now();
  }

  private startCountdown(): void {
    this.stopCountdown();
    this.syncCountdown();

    if (this.remainingSeconds !== null && this.remainingSeconds > 0) {
      this.countdownTimer = setInterval(() => this.syncCountdown(), 1000);
    }
  }

  private syncCountdown(): void {
    if (!this.expiresAt) {
      this.remainingSeconds = null;
      return;
    }

    const parsed = Date.parse(this.expiresAt);
    if (Number.isNaN(parsed)) {
      this.remainingSeconds = null;
      return;
    }

    this.remainingSeconds = Math.max(
      0,
      Math.ceil((parsed - Date.now()) / 1000)
    );

    if (this.remainingSeconds === 0) {
      this.stopCountdown();
    }
  }

  private stopCountdown(): void {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
      this.countdownTimer = undefined;
    }
  }

  private clearChallenge(): void {
    this.stopCountdown();
    sessionStorage.removeItem('mfa-challenge-id');
    sessionStorage.removeItem('mfa-expires-at');
    sessionStorage.removeItem('mfa-return-url');
  }

  private errorFrom(error: HttpErrorResponse, fallback: string): string {
    const apiMessage = error.error?.message;
    return typeof apiMessage === 'string' && apiMessage.trim()
      ? apiMessage
      : fallback;
  }
}
