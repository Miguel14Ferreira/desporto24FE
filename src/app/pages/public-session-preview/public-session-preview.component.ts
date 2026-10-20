import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { finalize, timeout } from 'rxjs';

import { environment } from 'src/environment/environment';
import { AuthenticationService } from '../../services/authethication.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { I18nService } from '../../i18n/i18n.service';

interface SessionPublicPreview {
  id: number;
  sport: string | null;
  city: string | null;
  gameDate: string | null;
  maxParticipants: number | null;
  // Aggregate public count; individual participants are never exposed.
  participantCount?: number | null;
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
  sharingSession = false;
  shareFeedbackKey = '';
  manualShareUrl = '';
  isAuthenticated = false;
  returnUrl: string | null = null;
  private sessionId: number | null = null;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly http: HttpClient,
    private readonly authenticationService: AuthenticationService,
    private readonly i18n: I18nService
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

  // Keep the join/waitlist section in view after sign-in or registration.
  // This never submits a join request automatically.
  get participationReturnUrl(): string | null {
    return this.returnUrl && this.canRequestParticipation
      ? this.returnUrl + '?join=1'
      : this.returnUrl;
  }

  retryLoad(): void {
    if (this.canRetry && !this.loading) {
      this.loadPreview();
    }
  }

  publicShareUrl(): string | null {
    return this.session && this.canRequestParticipation && this.sessionId !== null
      ? new URL('/sessions/' + this.sessionId, window.location.origin).href
      : null;
  }

  private shareMessage(): string {
    const sport = this.session?.sport?.trim();
    const city = this.session?.city?.trim();
    const messageKey = sport && city ? 'publicSession.whatsappSportCity'
      : sport ? 'publicSession.whatsappSport'
      : city ? 'publicSession.whatsappCity'
      : 'publicSession.shareMessage';
    const invitation = this.i18n.translate(messageKey, { sport: sport || '', city: city || '' });
    const start = Date.parse(this.session?.gameDate ?? '');
    if (!Number.isFinite(start)) {
      return invitation;
    }
    const locale = this.i18n.currentLanguage === 'en' ? 'en-GB' : 'pt-PT';
    const date = new Intl.DateTimeFormat(locale, {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).format(start);
    return invitation + '\n' + this.i18n.translate('publicSession.shareWhen', { date });
  }

  whatsappShareUrl(): string | null {
    const url = this.publicShareUrl();
    if (!url) {
      return null;
    }
    return 'https://wa.me/?text=' + encodeURIComponent(this.shareMessage() + '\n' + url);
  }

  async shareSession(): Promise<void> {
    const url = this.publicShareUrl();
    if (!url || this.sharingSession) {
      return;
    }

    this.sharingSession = true;
    this.shareFeedbackKey = '';
    this.manualShareUrl = '';
    try {
      if (typeof navigator.share === 'function') {
        try {
          await navigator.share({
            title: this.i18n.translate('publicSession.shareTitle', {
              sport: this.session?.sport || this.i18n.translate('publicSession.statusUnknown')
            }),
            text: this.shareMessage(),
            url
          });
          this.shareFeedbackKey = 'publicSession.shared';
          return;
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            return;
          }
        }
      }
      await this.copyShareUrl(url);
      this.shareFeedbackKey = 'publicSession.linkCopied';
    } catch {
      this.manualShareUrl = url;
      this.shareFeedbackKey = 'publicSession.manualShare';
    } finally {
      this.sharingSession = false;
    }
  }

  private copyShareUrl(url: string): Promise<void> {
    if (!navigator.clipboard?.writeText) {
      return Promise.reject(new Error('Clipboard unavailable'));
    }
    return navigator.clipboard.writeText(url);
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
          && error.status >= 400 && error.status < 500
          && error.status !== 408 && error.status !== 429;
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

  get remainingPlaces(): number | null {
    const session = this.session;
    const maximum = session?.maxParticipants;
    const confirmed = session?.participantCount;
    if (!session || session.status !== 'OPEN' || !this.canRequestParticipation
        || typeof maximum !== 'number' || !Number.isSafeInteger(maximum) || maximum <= 0
        || typeof confirmed !== 'number' || !Number.isSafeInteger(confirmed) || confirmed < 0) {
      return null;
    }
    return Math.max(0, maximum - confirmed);
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
