import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';

import { AuthenticationService } from '../../services/authethication.service';
import { GoogleRegistrationRequest } from '../model/google-auth-response';

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
  dateOfBirth = '';
  address = '';
  country = 'Portugal';
  location = '';
  postalCode = '';
  indicativePhone = '351';
  phone = '';
  gender = '';
  sportQuery = '';
  selectedSports: string[] = [];

  loading = false;
  errorMessage = '';

  readonly maxBirthDate = this.dateYearsAgo(18);
  readonly minBirthDate = this.dateYearsAgo(120);

  readonly sportsCatalog = [
    'Futebol',
    'Futsal',
    'Basquetebol',
    'Ténis',
    'Padel',
    'Voleibol',
    'Corrida',
    'Ciclismo',
    'Natação',
    'Andebol',
    'Rugby',
    'Badminton',
    'Ténis de mesa',
    'Squash',
    'Hóquei',
    'Surf',
    'Escalada',
    'Ginásio',
    'Yoga',
    'Pilates'
  ];

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

  get sportSuggestions(): string[] {
    const query = this.sportQuery.trim().toLocaleLowerCase('pt');
    return this.sportsCatalog
      .filter(sport => !this.selectedSports.includes(sport))
      .filter(sport => !query || sport.toLocaleLowerCase('pt').includes(query))
      .slice(0, 8);
  }

  addSport(sport: string): void {
    if (!this.sportsCatalog.includes(sport) || this.selectedSports.includes(sport)) {
      return;
    }

    this.selectedSports = [...this.selectedSports, sport];
    this.sportQuery = '';
  }

  removeSport(sport: string): void {
    this.selectedSports = this.selectedSports.filter(item => item !== sport);
  }

  onSportSearchKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter') {
      return;
    }

    event.preventDefault();

    const query = this.sportQuery.trim().toLocaleLowerCase('pt');
    const exactMatch = this.sportsCatalog.find(
      sport => sport.toLocaleLowerCase('pt') === query
    );

    if (exactMatch && !this.selectedSports.includes(exactMatch)) {
      this.addSport(exactMatch);
      return;
    }

    this.sportQuery = '';
  }

  clearInvalidSportQuery(): void {
    const query = this.sportQuery.trim();
    if (!query) {
      return;
    }

    const exactMatch = this.sportsCatalog.find(
      sport => sport.toLocaleLowerCase('pt') === query.toLocaleLowerCase('pt')
    );

    if (exactMatch && !this.selectedSports.includes(exactMatch)) {
      this.addSport(exactMatch);
      return;
    }

    this.sportQuery = '';
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
      dateOfBirth: this.dateOfBirth,
      address: this.address.trim(),
      country: this.country.trim(),
      location: this.location.trim(),
      postalCode: this.postalCode.trim(),
      indicativePhone: this.indicativePhone.replace(/\D/g, ''),
      phone: this.phone.replace(/\D/g, ''),
      gender: this.gender,
      favoriteSports: this.selectedSports.join(', ')
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
      this.address,
      this.country,
      this.location,
      this.postalCode,
      this.indicativePhone,
      this.phone,
      this.gender
    ];

    if (required.some(value => !value?.trim()) || this.selectedSports.length === 0) {
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
