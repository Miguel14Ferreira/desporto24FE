import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
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
export class LoginMFAComponent implements OnInit {
  code = '';
  challengeId = '';
  expiresAt = '';

  confirming = false;
  resending = false;
  errorMessage = '';
  successMessage = '';

  constructor(
    private authService: AuthenticationService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.challengeId = sessionStorage.getItem('mfa-challenge-id') || '';
    this.expiresAt = sessionStorage.getItem('mfa-expires-at') || '';

    if (!this.challengeId) {
      this.errorMessage = 'O desafio MFA já não está disponível. Inicia sessão novamente.';
    }
  }

  confirmCode(): void {
    const code = this.code.trim();

    if (!this.challengeId) {
      this.errorMessage = 'O desafio MFA expirou. Inicia sessão novamente.';
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

  expiryLabel(): string {
    if (!this.expiresAt) {
      return '';
    }

    const parsed = Date.parse(this.expiresAt);
    if (Number.isNaN(parsed)) {
      return '';
    }

    return new Intl.DateTimeFormat('pt-PT', {
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(parsed));
  }

  private clearChallenge(): void {
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
