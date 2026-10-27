import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { finalize, timeout } from 'rxjs';

import { environment } from 'src/environment/environment';
import { AuthenticationService } from '../../services/authethication.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { I18nService } from '../../i18n/i18n.service';
import { compactSessionShareMessage } from '../../shared/session-share-message';

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
  imports: [CommonModule, RouterModule, FormsModule, TranslatePipe],
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
  /** Guest invitations are scoped to a random organizer-issued link. */
  guestToken: string | null = null;
  guestPlayers: {id:number;name:string}[] = [];
  guestStep: 'choose' | 'confirm' | 'pending' | 'approved' | 'rejected' | 'linked' = 'choose';
  guestPlayerId: number | null = null;
  guestNewName = '';
  guestNote = '';
  guestLoading = false;
  guestSending = false;
  guestError = '';
  guestReceipt = '';
  guestCommunityId: number | null = null;
  guestLinked = false;
  guestLinking = false;

  get guestRegistrationReturnUrl(): string | null {
    return this.sessionId && this.guestToken
      ? '/sessions/' + this.sessionId + '?guest=' + this.guestToken : null;
  }

  linkGuestAccount(): void {
    if (!this.sessionId || !this.guestReceipt || this.guestStep !== 'approved'
        || !this.isAuthenticated || this.guestLinking) return;
    this.guestLinking=true;
    this.guestError='';
    this.http.post<{status:string;username:string}>(
      environment.apiUrl+'/api/sessions/'+this.sessionId+'/guest-requests/link-account',
      {receipt:this.guestReceipt}
    ).pipe(timeout(10000),finalize(()=>this.guestLinking=false)).subscribe({
      next: result => {
        if (result.status==='LINKED'){
          this.guestLinked=true;
          this.guestStep='linked';
        }
      },
      error: () => { this.guestError='guestRsvp.linkError'; }
    });
  }


  get guestPlayerName(): string {
    return this.guestPlayers.find(p => p.id === this.guestPlayerId)?.name
      || this.guestNewName.trim();
  }

  chooseGuest(): void {
    if ((this.guestPlayerId === null && (this.guestNewName.trim().length < 2 ||
        this.guestNewName.trim().length > 80)) || this.guestSending) return;
    this.guestError = '';
    this.guestStep = 'confirm';
  }

  backToGuestChoices(): void {
    if (!this.guestSending) {
      this.guestStep = 'choose';
      this.guestError = '';
    }
  }

  selectGuestPlayer(id: number | null): void {
    this.guestPlayerId = id === null ? null : Number(id);
    this.guestNewName = '';
  }

  setGuestNewName(name: string): void {
    this.guestNewName = name;
    if (name.trim()) this.guestPlayerId = null;
  }

  private receiptKey(): string {
    return 'jynlo-guest-receipt:' + this.sessionId;
  }

  private loadGuestRoster(): void {
    if (!this.sessionId || !this.guestToken || this.guestLoading) return;
    this.guestLoading = true;
    this.http.post<{sessionId:number;communityId:number;players:{id:number;name:string}[]}>(
      environment.apiUrl + '/api/sessions/' + this.sessionId + '/guest-roster',
      {token:this.guestToken}
    ).pipe(timeout(10000),finalize(() => this.guestLoading = false)).subscribe({
      next: data => {
        if (data.sessionId !== this.sessionId || !Array.isArray(data.players)) {
          this.guestError = 'guestRsvp.invalidLink'; return;
        }
        this.guestPlayers = data.players;
        this.guestCommunityId = data.communityId;
        try {
          const receipt = localStorage.getItem(this.receiptKey());
          if (receipt && /^[A-Za-z0-9_-]{43}$/.test(receipt)) {
            this.guestReceipt = receipt;
            this.checkGuestStatus();
          }
        } catch { /* Private browsing may disable storage. */ }
      },
      error: () => {this.guestError='guestRsvp.invalidLink';}
    });
  }

  sendGuestRequest(): void {
    if (!this.sessionId || !this.guestToken || this.guestStep !== 'confirm' ||
        this.guestSending || !this.guestPlayerName) return;
    this.guestSending = true;
    this.guestError = '';
    this.http.post<{receipt:string;status:string}>(
      environment.apiUrl + '/api/sessions/' + this.sessionId + '/guest-requests',
      {linkToken:this.guestToken,playerId:this.guestPlayerId,
       newName:this.guestPlayerId===null?this.guestNewName.trim():null,
       note:this.guestNote.trim()}
    ).pipe(timeout(10000),finalize(() => this.guestSending=false)).subscribe({
      next: response => {
        this.guestReceipt = response.receipt;
        try {localStorage.setItem(this.receiptKey(),response.receipt);} catch {}
        this.guestStep='pending';
      },
      error: () => {this.guestError='guestRsvp.requestError';}
    });
  }

  checkGuestStatus(): void {
    if (!this.sessionId || !this.guestReceipt || this.guestSending) return;
    this.guestSending=true;
    this.guestError='';
    this.http.post<{status:'PENDING'|'APPROVED'|'REJECTED'|'LINKED'}>(
      environment.apiUrl + '/api/sessions/' + this.sessionId + '/guest-requests/status',
      {receipt:this.guestReceipt}
    ).pipe(timeout(10000),finalize(()=>this.guestSending=false)).subscribe({
      next: r => {
        this.guestStep=r.status==='LINKED'?'linked':
          r.status==='APPROVED'?'approved':
          r.status==='REJECTED'?'rejected':'pending';
      },
      error:()=>{this.guestError='guestRsvp.statusError';}
    });
  }


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
    const token=this.route.snapshot.queryParamMap?.get('guest');
    if (token && /^[A-Za-z0-9_-]{43}$/.test(token)) {
      this.guestToken=token;
      if (!this.isAuthenticated) {
        // Anonymous guests can choose a historical name. Known Jynlo members
        // never see that impersonation-prone selector.
        this.loadGuestRoster();
      } else {
        // After optional sign-up, only a prior private approval receipt
        // authorizes transferring the guest seat to the real account.
        try {
          const receipt = localStorage.getItem(this.receiptKey());
          if (receipt && /^[A-Za-z0-9_-]{43}$/.test(receipt)) {
            this.guestReceipt=receipt;
            this.checkGuestStatus();
          }
        } catch { /* storage is optional */ }
      }
    }
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
    return compactSessionShareMessage({
      sport: this.session?.sport,
      city: this.session?.city,
      gameDate: this.session?.gameDate,
      remainingPlaces: this.remainingPlaces
    }, this.i18n.currentLanguage === 'en' ? 'en-GB' : 'pt-PT');
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

  get displayGameDate(): string | null {
    const rawDate = this.session?.gameDate;
    // Legacy or incomplete public API records must never crash Angular DatePipe.
    return rawDate && Number.isFinite(Date.parse(rawDate)) ? rawDate : null;
  }

  /** Public preview only exposes the municipality, never the protected street address. */
  get cityMapsUrl(): string | null {
    const city = this.session?.city?.trim();
    return city ? 'https://www.google.com/maps/search/?api=1&query='
      + encodeURIComponent(city + ', Portugal') : null;
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
