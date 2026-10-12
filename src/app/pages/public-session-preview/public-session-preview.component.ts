import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { finalize, timeout } from 'rxjs';

import { environment } from 'src/environment/environment';
import { AuthenticationService } from '../../services/authethication.service';
import { TranslatePipe } from '../../i18n/translate.pipe';

interface SessionPublicPreview {
  id: number;
  sport: string | null;
  city: string | null;
  gameDate: string | null;
  maxParticipants: number | null;
  priceAmount: number | null;
  status: 'OPEN' | 'FULL' | 'CANCELLED' | 'COMPLETED' | null;
  gamePhoto: string | null;
}

@Component({
  selector: 'app-public-session-preview',
  standalone: true,
  imports: [CommonModule, RouterModule, TranslatePipe],
  templateUrl: './public-session-preview.component.html',
  styleUrls: ['./public-session-preview.component.css'],
  changeDetection: ChangeDetectionStrategy.Eager
})
export class PublicSessionPreviewComponent implements OnInit {
  session: SessionPublicPreview | null = null;
  loading = true;
  errorMessageKey = '';
  canRetry = false;
  isAuthenticated = false;
  returnUrl: string | null = null;
  private sessionId: number | null = null;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly http: HttpClient,
    private readonly authenticationService: AuthenticationService
  ) {}

  ngOnInit(): void {
    // An expired access token may still be renewed by the protected route guard.
    this.isAuthenticated = this.authenticationService.isLoggedIn()
      || this.authenticationService.hasSessionCandidate();
    const rawId = this.route.snapshot.paramMap.get('id');
    const id = rawId !== null && /^[1-9]\d*$/.test(rawId) ? Number(rawId) : NaN;
    if (!Number.isSafeInteger(id)) {
      this.loading = false;
      this.errorMessageKey = 'publicSession.invalidLink';
      return;
    }

    this.sessionId = id;
    this.returnUrl = '/menu/events/' + id;
    this.loadPreview();
  }

  retryLoad(): void {
    if (this.canRetry && !this.loading) {
      this.loadPreview();
    }
  }

  private loadPreview(): void {
    if (this.sessionId === null) {
      return;
    }

    this.loading = true;
    this.session = null;
    this.errorMessageKey = '';
    this.canRetry = false;

    this.http.get<SessionPublicPreview>(
      environment.apiUrl + '/api/sessions/' + this.sessionId + '/public-preview'
    ).pipe(
      timeout(10000),
      finalize(() => this.loading = false)
    ).subscribe({
      next: session => {
        // Never display or link to a different session than the shared URL.
        if (session?.id !== this.sessionId) {
          this.errorMessageKey = 'publicSession.unavailable';
          this.canRetry = false;
          return;
        }
        this.session = session;
      },
      error: (error: unknown) => {
        const unavailable = error instanceof HttpErrorResponse
          && error.status >= 400 && error.status < 500;
        this.canRetry = !unavailable;
        this.errorMessageKey = unavailable
          ? 'publicSession.unavailable'
          : 'publicSession.loadError';
      }
    });
  }

  get photoUrl(): string | null {
    const photo = this.session?.gamePhoto;
    if (!photo) {
      return null;
    }
    if (photo.startsWith('https://') || photo.startsWith('http://')) {
      return photo;
    }
    return environment.apiUrl + (photo.startsWith('/') ? photo : '/' + photo);
  }

  get canRequestParticipation(): boolean {
    if (!this.session || (this.session.status !== 'OPEN' && this.session.status !== 'FULL')) {
      return false;
    }

    const startTime = Date.parse(this.session.gameDate ?? '');
    return Number.isFinite(startTime) && startTime > Date.now();
  }

  get statusKey(): string {
    if ((this.session?.status === 'OPEN' || this.session?.status === 'FULL')
        && !this.canRequestParticipation) {
      return 'publicSession.statusClosed';
    }

    switch (this.session?.status) {
      case 'OPEN': return 'publicSession.statusOpen';
      case 'FULL': return 'publicSession.statusFull';
      case 'CANCELLED': return 'publicSession.statusCancelled';
      case 'COMPLETED': return 'publicSession.statusCompleted';
      default: return 'publicSession.statusUnknown';
    }
  }
}
