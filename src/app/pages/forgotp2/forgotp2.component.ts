import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';

import { AuthenticationService } from '../../services/authethication.service';

@Component({
  selector: 'app-forgotp2',
  templateUrl: './forgotp2.component.html',
  styleUrls: ['./forgotp2.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false
})
export class Forgotp2Component implements OnInit {
  token = '';
  newPassword = '';
  confirmPassword = '';
  showPassword = false;

  loading = false;
  errorMessage = '';
  successMessage = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private authenticationService: AuthenticationService
  ) {}

  ngOnInit(): void {
    this.token = this.route.snapshot.paramMap.get('token') || '';

    if (!this.token) {
      this.errorMessage = 'O link de recuperação não contém um token válido.';
    }
  }

  resetPassword(): void {
    if (!this.token || this.loading) {
      return;
    }

    this.errorMessage = '';
    this.successMessage = '';

    if (this.newPassword.length < 8) {
      this.errorMessage = 'A nova palavra-passe tem de ter pelo menos 8 caracteres.';
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.errorMessage = 'A nova palavra-passe e a confirmação não coincidem.';
      return;
    }

    this.loading = true;

    this.authenticationService.confirmPasswordReset(this.token, this.newPassword)
      .pipe(finalize(() => this.loading = false))
      .subscribe({
        next: response => {
          this.successMessage = response.message || 'Palavra-passe alterada com sucesso.';
          this.newPassword = '';
          this.confirmPassword = '';
        },
        error: error => {
          this.errorMessage = this.errorFrom(
            error,
            'Não foi possível redefinir a palavra-passe. O link pode ter expirado.'
          );
        }
      });
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }

  private errorFrom(error: HttpErrorResponse, fallback: string): string {
    const apiMessage = error.error?.message;
    return typeof apiMessage === 'string' && apiMessage.trim()
      ? apiMessage
      : fallback;
  }
}
