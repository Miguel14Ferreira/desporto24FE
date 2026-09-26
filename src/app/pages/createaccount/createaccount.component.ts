import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { finalize } from 'rxjs';

import { RegistrationRequest } from '../model/registration-request';
import { AuthenticationService } from '../../services/authethication.service';

@Component({
  selector: 'app-createaccount',
  templateUrl: './createaccount.component.html',
  styleUrls: ['./createaccount.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false
})
export class CreateaccountComponent {
  username = '';
  password = '';
  confirmPassword = '';
  fullName = '';
  dateOfBirth = '';
  address = '';
  country = '';
  location = '';
  postalCode = '';
  phone = '+351 ';
  gender = '';
  email = '';
  favoriteSports = '';

  showPassword = false;
  photo?: File;
  photoPreview = '';

  loading = false;
  errorMessage = '';
  successMessage = '';

  constructor(private authenticationService: AuthenticationService) {}

  register(): void {
    const validation = this.validate();
    if (validation) {
      this.errorMessage = validation;
      this.successMessage = '';
      return;
    }

    const parsedPhone = this.parsePhone();
    if (!parsedPhone) {
      this.errorMessage = 'Introduz um telemóvel português válido. Ex.: +351 927 382 368.';
      this.successMessage = '';
      return;
    }

    const request: RegistrationRequest = {
      username: this.username.trim(),
      password: this.password,
      fullName: this.fullName.trim(),
      dateOfBirth: this.dateOfBirth,
      address: this.address.trim(),
      country: this.country.trim(),
      location: this.location.trim(),
      postalCode: this.postalCode.trim(),
      indicativePhone: parsedPhone.indicativePhone,
      phone: parsedPhone.phone,
      gender: this.gender,
      email: this.email.trim(),
      favoriteSports: this.favoriteSports.trim()
    };

    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.authenticationService.register(request, this.photo)
      .pipe(finalize(() => this.loading = false))
      .subscribe({
        next: response => {
          this.successMessage = response.message
            || 'Conta criada. Confirma o email para ativares a conta.';
        },
        error: error => {
          this.errorMessage = this.errorFrom(
            error,
            'Não foi possível criar a conta.'
          );
        }
      });
  }

  onPhotoChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) {
      this.photo = undefined;
      this.photoPreview = '';
      return;
    }

    if (!file.type.startsWith('image/')) {
      this.errorMessage = 'Escolhe um ficheiro de imagem.';
      input.value = '';
      return;
    }

    this.photo = file;
    this.errorMessage = '';

    const reader = new FileReader();
    reader.onload = () => {
      this.photoPreview = typeof reader.result === 'string' ? reader.result : '';
    };
    reader.readAsDataURL(file);
  }

  private validate(): string | null {
    const required = [
      this.username,
      this.password,
      this.confirmPassword,
      this.fullName,
      this.dateOfBirth,
      this.address,
      this.country,
      this.location,
      this.postalCode,
      this.phone,
      this.gender,
      this.email,
      this.favoriteSports
    ];

    if (required.some(value => !value?.trim())) {
      return 'Preenche todos os campos obrigatórios.';
    }

    if (this.username.trim().length < 3) {
      return 'O nome de utilizador tem de ter pelo menos 3 caracteres.';
    }

    if (this.password.length < 8) {
      return 'A palavra-passe tem de ter pelo menos 8 caracteres.';
    }

    if (this.password !== this.confirmPassword) {
      return 'A palavra-passe e a confirmação não coincidem.';
    }

    if (!this.email.includes('@')) {
      return 'Introduz um email válido.';
    }

    if (!this.parsePhone()) {
      return 'Introduz um telemóvel português válido. Ex.: +351 927 382 368.';
    }

    return null;
  }

  private parsePhone(): { indicativePhone: string; phone: string } | null {
    const compact = this.phone.replace(/[\s()-]/g, '');

    if (/^\+351\d{9}$/.test(compact)) {
      return { indicativePhone: '351', phone: compact.substring(4) };
    }

    if (/^351\d{9}$/.test(compact)) {
      return { indicativePhone: '351', phone: compact.substring(3) };
    }

    if (/^\d{9}$/.test(compact)) {
      return { indicativePhone: '351', phone: compact };
    }

    return null;
  }

  private errorFrom(error: HttpErrorResponse, fallback: string): string {
    const apiMessage = error.error?.message;
    return typeof apiMessage === 'string' && apiMessage.trim()
      ? apiMessage
      : fallback;
  }
}
