import { HttpErrorResponse } from '@angular/common/http';
import { appTranslate as t } from '../../i18n/i18n.service';
import { AfterViewInit, ChangeDetectionStrategy, Component, NgZone, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';

import { AuthenticationService } from '../../services/authethication.service';

declare global {
  interface Window {
    google?: any;
  }
}

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false
})
export class LoginComponent implements OnInit, AfterViewInit {
  username = '';
  password = '';
  showPassword = false;

  loading = false;
  errorMessage = '';
  successMessage = '';
  canResendConfirmation = false;
  resendLoading = false;
  resendCooldownSeconds = 0;
  googleLoading = false;
  googleReady = false;

  private resendCooldownTimer?: ReturnType<typeof setInterval>;

  private returnUrl = '/menu';

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private authenticationService: AuthenticationService,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    this.returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/menu';

    this.successMessage = sessionStorage.getItem('auth-success-message') || '';
    this.errorMessage = sessionStorage.getItem('auth-error-message') || '';
    sessionStorage.removeItem('auth-success-message');
    sessionStorage.removeItem('auth-error-message');

    if (this.authenticationService.hasValidToken()) {
      this.router.navigateByUrl(this.returnUrl);
    }
  }

  ngAfterViewInit(): void {
    this.authenticationService.googleConfig().subscribe({
      next: config => {
        if (!config.clientId?.trim()) {
          return;
        }

        this.loadGoogleIdentityScript(config.clientId.trim());
      }
    });
  }

  private loadGoogleIdentityScript(clientId: string): void {
    const initialize = () => {
      if (!window.google?.accounts?.id) {
        return;
      }

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (response: { credential?: string }) => {
          this.ngZone.run(() => this.handleGoogleCredential(response.credential || ''));
        }
      });

      const host = document.getElementById('google-signin-button');
      if (!host) {
        return;
      }

      host.innerHTML = '';
      const width = Math.max(260, Math.min(420, Math.floor(host.getBoundingClientRect().width || 360)));

      window.google.accounts.id.renderButton(host, {
        theme: 'outline',
        size: 'large',
        width,
        text: 'continue_with',
        shape: 'pill'
      });
      this.googleReady = true;
    };

    if (window.google?.accounts?.id) {
      initialize();
      return;
    }

    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]'
    );
    if (existing) {
      existing.addEventListener('load', initialize, { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = initialize;
    document.head.appendChild(script);
  }

  private handleGoogleCredential(credential: string): void {
    if (!credential || this.googleLoading) {
      return;
    }

    this.googleLoading = true;
    this.errorMessage = '';

    this.authenticationService.googleLogin(credential)
      .pipe(finalize(() => this.googleLoading = false))
      .subscribe({
        next: response => {
          if (response.onboardingRequired) {
            sessionStorage.setItem('google-onboarding-credential', credential);
            sessionStorage.setItem('google-onboarding-email', response.email || '');
            sessionStorage.setItem('google-onboarding-name', response.fullName || '');
            sessionStorage.setItem('google-onboarding-picture', response.pictureUrl || '');
            this.router.navigate(['/login/google/complete-profile']);
            return;
          }

          if (response.mfaRequired) {
            if (!response.challengeId) {
              this.errorMessage = 'Não foi possível iniciar a autenticação multifator.';
              return;
            }

            sessionStorage.setItem('mfa-challenge-id', response.challengeId);
            sessionStorage.setItem('mfa-return-url', this.returnUrl);

            if (response.challengeExpiresAt) {
              sessionStorage.setItem('mfa-expires-at', response.challengeExpiresAt);
            } else {
              sessionStorage.removeItem('mfa-expires-at');
            }

            this.router.navigate(['/login/MFAauthentication', 'google']);
            return;
          }

          if (!response.token) {
            this.errorMessage = 'Não foi possível concluir o login com Google.';
            return;
          }

          this.authenticationService.saveToken(response.token);
          this.router.navigateByUrl(this.returnUrl);
        },
        error: error => {
          this.errorMessage = this.errorFrom(
            error,
            'Não foi possível iniciar sessão com Google.'
          );
        }
      });
  }

  onLogin(): void {
    const username = this.username.trim();

    if (!username || !this.password) {
      this.errorMessage = t('feedback.login.required');
      return;
    }

    if (this.loading) {
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.canResendConfirmation = false;

    this.authenticationService.login(username, this.password)
      .pipe(finalize(() => this.loading = false))
      .subscribe({
        next: response => {
          if (response.mfaRequired) {
            if (!response.challengeId) {
              this.errorMessage = t('feedback.login.noChallenge');
              return;
            }

            sessionStorage.setItem('mfa-challenge-id', response.challengeId);
            sessionStorage.setItem('mfa-return-url', this.returnUrl);

            if (response.challengeExpiresAt) {
              sessionStorage.setItem('mfa-expires-at', response.challengeExpiresAt);
            } else {
              sessionStorage.removeItem('mfa-expires-at');
            }

            this.router.navigate(['/login/MFAauthentication', username]);
            return;
          }

          if (!response.token) {
            this.errorMessage = t('feedback.login.noToken');
            return;
          }

          this.authenticationService.saveToken(response.token);
          this.router.navigateByUrl(this.returnUrl);
        },
        error: error => {
          this.errorMessage = this.errorFrom(
            error,
            t('feedback.login.error')
          );

          const normalizedError = this.errorMessage.toLowerCase();
          this.canResendConfirmation =
            normalizedError.includes('email ainda não está verificado')
            || normalizedError.includes('email ainda não foi verificado')
            || normalizedError.includes('verifica o teu email');
        }
      });
  }

  resendConfirmation(): void {
    const username = this.username.trim();
    if (!username || this.resendLoading) {
      return;
    }

    this.resendLoading = true;
    this.successMessage = '';

    this.authenticationService.resendRegistrationConfirmation(username)
      .pipe(finalize(() => this.resendLoading = false))
      .subscribe({
        next: response => {
          this.successMessage = t('feedback.register.resent');
          this.errorMessage = '';
          this.startResendCooldown();
        },
        error: error => {
          this.errorMessage = this.errorFrom(
            error,
            t('feedback.register.resendError')
          );
        }
      });
  }

  private startResendCooldown(): void {
    this.resendCooldownSeconds = 60;
    if (this.resendCooldownTimer) {
      clearInterval(this.resendCooldownTimer);
    }
    this.resendCooldownTimer = setInterval(() => {
      this.resendCooldownSeconds = Math.max(0, this.resendCooldownSeconds - 1);
      if (this.resendCooldownSeconds === 0 && this.resendCooldownTimer) {
        clearInterval(this.resendCooldownTimer);
        this.resendCooldownTimer = undefined;
      }
    }, 1000);
  }

  private errorFrom(error: HttpErrorResponse, fallback: string): string {
    const apiMessage = error.error?.message;
    return typeof apiMessage === 'string' && apiMessage.trim()
      ? apiMessage
      : fallback;
  }
}
