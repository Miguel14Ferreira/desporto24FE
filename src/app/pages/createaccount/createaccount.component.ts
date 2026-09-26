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
  indicativePhone = '351';
  phone = '';
  gender = '';
  email = '';
  favoriteSports = '';

  readonly phoneIndicatives = [
    { code: '351', label: 'Portugal (+351)' },
    { code: '244', label: 'Angola (+244)' },
    { code: '55', label: 'Brasil (+55)' },
    { code: '238', label: 'Cabo Verde (+238)' },
    { code: '245', label: 'Guiné-Bissau (+245)' },
    { code: '258', label: 'Moçambique (+258)' },
    { code: '239', label: 'São Tomé e Príncipe (+239)' },
    { code: '34', label: 'Espanha (+34)' },
    { code: '33', label: 'França (+33)' },
    { code: '44', label: 'Reino Unido (+44)' },
    { code: '49', label: 'Alemanha (+49)' },
    { code: '39', label: 'Itália (+39)' },
    { code: '41', label: 'Suíça (+41)' },
    { code: '352', label: 'Luxemburgo (+352)' },
    { code: '32', label: 'Bélgica (+32)' },
    { code: '31', label: 'Países Baixos (+31)' },
    { code: '353', label: 'Irlanda (+353)' },
    { code: '1', label: 'Estados Unidos / Canadá (+1)' }
  ];

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

    const request: RegistrationRequest = {
      username: this.username.trim(),
      password: this.password,
      fullName: this.fullName.trim(),
      dateOfBirth: this.dateOfBirth,
      address: this.address.trim(),
      country: this.country.trim(),
      location: this.location.trim(),
      postalCode: this.postalCode.trim(),
      indicativePhone: this.indicativePhone,
      phone: this.phone.replace(/\D/g, ''),
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
      this.indicativePhone,
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

    const normalizedPhone = this.phone.replace(/\D/g, '');
    if (normalizedPhone.length < 6 || normalizedPhone.length > 15) {
      return 'Introduz um número de telemóvel válido.';
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
