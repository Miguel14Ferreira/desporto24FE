import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';

import { AuthenticationService } from '../../services/authethication.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false
})
export class LoginComponent implements OnInit {
  username = '';
  password = '';
  showPassword = false;

  loading = false;
  errorMessage = '';
  successMessage = '';

  private returnUrl = '/menu';

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private authenticationService: AuthenticationService
  ) {}

  ngOnInit(): void {
    this.returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/menu';

    this.successMessage = sessionStorage.getItem('auth-success-message') || '';
    sessionStorage.removeItem('auth-success-message');

    if (this.authenticationService.hasValidToken()) {
      this.router.navigateByUrl(this.returnUrl);
    }
  }

  onLogin(): void {
    const username = this.username.trim();

    if (!username || !this.password) {
      this.errorMessage = 'Preenche o nome de utilizador e a palavra-passe.';
      return;
    }

    if (this.loading) {
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    this.authenticationService.login(username, this.password)
      .pipe(finalize(() => this.loading = false))
      .subscribe({
        next: response => {
          if (response.mfaRequired) {
            if (!response.challengeId) {
              this.errorMessage = 'O servidor não devolveu um desafio MFA válido.';
              return;
            }

            sessionStorage.setItem('mfa-challenge-id', response.challengeId);
            sessionStorage.setItem('mfa-return-url', this.returnUrl);

            if (response.expiresAt) {
              sessionStorage.setItem('mfa-expires-at', response.expiresAt);
            } else {
              sessionStorage.removeItem('mfa-expires-at');
            }

            this.router.navigate(['/login/MFAauthentication', username]);
            return;
          }

          if (!response.token) {
            this.errorMessage = 'O servidor não devolveu um token de autenticação.';
            return;
          }

          this.authenticationService.saveToken(response.token);
          this.router.navigateByUrl(this.returnUrl);
        },
        error: error => {
          this.errorMessage = this.errorFrom(
            error,
            'Não foi possível iniciar sessão. Confirma as credenciais.'
          );
        }
      });
  }

  private errorFrom(error: HttpErrorResponse, fallback: string): string {
    const apiMessage = error.error?.message;
    return typeof apiMessage === 'string' && apiMessage.trim()
      ? apiMessage
      : fallback;
  }
}
