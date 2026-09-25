import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { finalize } from 'rxjs';

import { MyProfileService } from '../../services/my-profile.service';

@Component({
  selector: 'app-changepassword',
  templateUrl: './changepassword.component.html',
  styleUrls: ['./changepassword.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false
})
export class ChangepasswordComponent {
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';

  showCurrent = false;
  showNew = false;

  saving = false;
  errorMessage = '';
  successMessage = '';

  constructor(private myProfileService: MyProfileService) {}

  changePassword(): void {
    if (this.saving) {
      return;
    }

    this.errorMessage = '';
    this.successMessage = '';

    if (!this.currentPassword || !this.newPassword || !this.confirmPassword) {
      this.errorMessage = 'Preenche todos os campos.';
      return;
    }

    if (this.newPassword.length < 8) {
      this.errorMessage = 'A nova palavra-passe tem de ter pelo menos 8 caracteres.';
      return;
    }

    if (this.newPassword !== this.confirmPassword) {
      this.errorMessage = 'A nova palavra-passe e a confirmação não coincidem.';
      return;
    }

    if (this.currentPassword === this.newPassword) {
      this.errorMessage = 'A nova palavra-passe tem de ser diferente da atual.';
      return;
    }

    this.saving = true;

    this.myProfileService.changePassword(this.currentPassword, this.newPassword)
      .pipe(finalize(() => this.saving = false))
      .subscribe({
        next: () => {
          this.currentPassword = '';
          this.newPassword = '';
          this.confirmPassword = '';
          this.successMessage = 'Palavra-passe alterada com sucesso.';
        },
        error: error => {
          this.errorMessage = this.errorFrom(
            error,
            'Não foi possível alterar a palavra-passe.'
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
