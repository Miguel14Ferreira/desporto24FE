import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';

import { CreateSessionRequest } from '../model/create-session-request';
import { SessionService } from '../../services/session.service';

@Component({
  selector: 'app-events2',
  templateUrl: './events2.component.html',
  styleUrls: ['./events2.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager,
  standalone: false
})
export class Events2Component implements OnInit {
  sport = '';
  gameDate = '';
  city = '';
  address = '';
  maxParticipants = 4;

  privateGame = false;
  password = '';

  hasPrice = false;
  priceAmount: number | null = null;

  photo?: File;
  photoPreview = '';
  minDate = '';

  loading = false;
  errorMessage = '';

  constructor(
    private sessionService: SessionService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.minDate = this.toLocalDateTimeValue(new Date());
  }

  createSession(): void {
    const validationError = this.validate();
    if (validationError) {
      this.errorMessage = validationError;
      return;
    }

    const request: CreateSessionRequest = {
      sport: this.sport.trim(),
      gameDate: new Date(this.gameDate).toISOString(),
      city: this.city.trim(),
      address: this.address.trim(),
      maxParticipants: Number(this.maxParticipants),
      priceAmount: this.hasPrice ? Number(this.priceAmount ?? 0) : 0,
      privateGame: this.privateGame,
      password: this.privateGame ? this.password.trim() : null,
      latitude: null,
      longitude: null
    };

    this.loading = true;
    this.errorMessage = '';

    this.sessionService.create(request, this.photo)
      .pipe(finalize(() => this.loading = false))
      .subscribe({
        next: session => this.router.navigate(['/menu/events', session.id]),
        error: error => {
          this.errorMessage = this.errorFrom(
            error,
            'Não foi possível criar a sessão. Confirma os dados e tenta novamente.'
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

  clearPhoto(): void {
    this.photo = undefined;
    this.photoPreview = '';
  }

  private validate(): string | null {
    if (!this.sport.trim() || !this.gameDate || !this.city.trim() || !this.address.trim()) {
      return 'Preenche o desporto, data, localidade e morada.';
    }

    const gameInstant = new Date(this.gameDate);
    if (Number.isNaN(gameInstant.getTime()) || gameInstant.getTime() <= Date.now()) {
      return 'A data da sessão tem de ser no futuro.';
    }

    const players = Number(this.maxParticipants);
    if (!Number.isInteger(players) || players < 2 || players > 100) {
      return 'O número máximo de jogadores tem de estar entre 2 e 100.';
    }

    if (this.privateGame && !this.password.trim()) {
      return 'Define uma palavra-passe para a sessão privada.';
    }

    if (this.hasPrice) {
      const price = Number(this.priceAmount);
      if (!Number.isFinite(price) || price < 0) {
        return 'O preço por jogador não pode ser negativo.';
      }
    }

    return null;
  }

  private errorFrom(error: HttpErrorResponse, fallback: string): string {
    const apiMessage = error.error?.message;
    return typeof apiMessage === 'string' && apiMessage.trim()
      ? apiMessage
      : fallback;
  }

  private toLocalDateTimeValue(date: Date): string {
    const pad = (value: number) => String(value).padStart(2, '0');
    return [
      date.getFullYear(),
      '-',
      pad(date.getMonth() + 1),
      '-',
      pad(date.getDate()),
      'T',
      pad(date.getHours()),
      ':',
      pad(date.getMinutes())
    ].join('');
  }
}
