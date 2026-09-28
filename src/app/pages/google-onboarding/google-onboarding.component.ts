import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';

import { AuthenticationService } from '../../services/authethication.service';
import { GoogleRegistrationRequest } from '../model/google-auth-response';
import { COUNTRY_CALLING_CODES, countryNameFromLabel } from '../../shared/country-calling-codes';

@Component({
  selector: 'app-google-onboarding',
  templateUrl: './google-onboarding.component.html',
  styleUrls: ['./google-onboarding.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false
})
export class GoogleOnboardingComponent implements OnInit {
  credential = '';
  email = '';
  fullName = '';
  pictureUrl = '';

  username = '';
  nickname = '';
  dateOfBirth = '';
  country = 'Portugal';
  indicativePhone = '351';
  phone = '';
  gender = '';

  loading = false;
  errorMessage = '';

  readonly maxBirthDate = this.dateYearsAgo(18);
  readonly minBirthDate = this.dateYearsAgo(120);

  readonly countryOptions = COUNTRY_CALLING_CODES;

  constructor(
    private authenticationService: AuthenticationService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.credential = sessionStorage.getItem('google-onboarding-credential') || '';
    this.email = sessionStorage.getItem('google-onboarding-email') || '';
    this.fullName = sessionStorage.getItem('google-onboarding-name') || '';
    this.pictureUrl = sessionStorage.getItem('google-onboarding-picture') || '';

    if (!this.credential || !this.email) {
      this.router.navigate(['/login']);
    }
  }

  countryName(label: string): string {
    return countryNameFromLabel(label);
  }

  submit(): void {
    const validation = this.validate();
    if (validation || this.loading) {
      this.errorMessage = validation || '';
      return;
    }

    const request: GoogleRegistrationRequest = {
      credential: this.credential,
      username: this.username.trim(),
      nickname: this.nickname.trim() || null,
      dateOfBirth: this.dateOfBirth,
      country: this.country.trim(),
      indicativePhone: this.indicativePhone.replace(/\D/g, ''),
      phone: this.phone.replace(/\D/g, ''),
      gender: this.gender || null
    };

    this.loading = true;
    this.errorMessage = '';

    this.authenticationService.googleRegister(request)
      .pipe(finalize(() => this.loading = false))
      .subscribe({
        next: response => {
          if (!response.token) {
            this.errorMessage = 'A conta foi criada, mas não foi possível iniciar a sessão.';
            return;
          }

          this.authenticationService.saveToken(response.token);
          this.clearPendingGoogleRegistration();
          this.router.navigate(['/menu']);
        },
        error: error => {
          this.errorMessage = this.errorFrom(
            error,
            'Não foi possível concluir o registo com Google.'
          );
        }
      });
  }

  cancel(): void {
    this.clearPendingGoogleRegistration();
    this.router.navigate(['/login']);
  }

  private validate(): string | null {
    const required = [
      this.username,
      this.dateOfBirth,
      this.country,
      this.indicativePhone,
      this.phone
    ];

    if (required.some(value => !value?.trim())) {
      return 'Preenche todos os campos obrigatórios.';
    }

    if (this.username.trim().length < 3) {
      return 'O nome de utilizador deve ter pelo menos 3 caracteres.';
    }

    if (!this.isAdultBirthDate(this.dateOfBirth)) {
      return 'Tens de ter pelo menos 18 anos.';
    }

    const indicative = this.indicativePhone.replace(/\D/g, '');
    const phone = this.phone.replace(/\D/g, '');
    if (phone.length < 4 || indicative.length + phone.length > 15) {
      return 'Introduz um número de telefone válido.';
    }

    return null;
  }

  private isAdultBirthDate(value: string): boolean {
    const birthDate = new Date(value + 'T00:00:00');
    if (Number.isNaN(birthDate.getTime())) {
      return false;
    }

    const minDate = new Date(this.minBirthDate + 'T00:00:00');
    const maxDate = new Date(this.maxBirthDate + 'T00:00:00');
    return birthDate >= minDate && birthDate <= maxDate;
  }

  private dateYearsAgo(years: number): string {
    const date = new Date();
    date.setFullYear(date.getFullYear() - years);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private clearPendingGoogleRegistration(): void {
    sessionStorage.removeItem('google-onboarding-credential');
    sessionStorage.removeItem('google-onboarding-email');
    sessionStorage.removeItem('google-onboarding-name');
    sessionStorage.removeItem('google-onboarding-picture');
  }

  private errorFrom(error: HttpErrorResponse, fallback: string): string {
    const apiMessage = error.error?.message;
    return typeof apiMessage === 'string' && apiMessage.trim()
      ? apiMessage
      : fallback;
  }
}
