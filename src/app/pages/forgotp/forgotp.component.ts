import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { finalize } from 'rxjs';

import { AuthenticationService } from '../../services/authethication.service';

@Component({
  selector: 'app-forgotp',
  templateUrl: './forgotp.component.html',
  styleUrls: ['./forgotp.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false
})
export class ForgotpComponent {
  email = '';
  loading = false;
  errorMessage = '';
  successMessage = '';

  constructor(private authenticationService: AuthenticationService) {}

  sendResetEmail(): void {
    const email = this.email.trim();

    if (!email) {
      this.errorMessage = 'Introduz o email associado à tua conta.';
      this.successMessage = '';
      return;
    }

    if (this.loading) {
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.authenticationService.initiatePasswordReset(email)
      .pipe(finalize(() => this.loading = false))
      .subscribe({
        next: response => {
          this.successMessage = response.message
            || 'Foi enviado um email com instruções para redefinir a palavra-passe.';
        },
        error: error => {
          this.errorMessage = this.errorFrom(
            error,
            'Não foi possível iniciar o reset da palavra-passe.'
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
