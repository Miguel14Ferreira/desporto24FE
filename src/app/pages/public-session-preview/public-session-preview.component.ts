import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
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
  /** Only included in a validated signed invitation, never anonymous public GET. */
  venueName?: string | null;
  address?: string | null;
}

interface ConfirmedSessionPlayer {
  key: string;
  name: string;
  hasAccount: boolean;
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
  confirmedPlayers: ConfirmedSessionPlayer[] = [];
  confirmedPlayersLoading = false;
  confirmedPlayersError = false;
  guestConfirmedName = '';
  /** Only returned to this guest after their private RSVP receipt is approved. */
  guestMeetingPoint = '';
  guestStep: 'choose' | 'confirm' | 'pending' | 'approved' | 'rejected' | 'linked' | 'cancelled' = 'choose';
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
  guestEditingIdentity = false;
  guestChangingIdentity = false;
  guestConfirmCancellation = false;
  guestCancelling = false;
  guestCancelledBySelf = false;
  guestSavedBookings: {receipt:string;name:string}[] = [];
  memberJoining = false;
  memberJoinError = '';

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


  /**
   * A user with an account must confirm attendance with the signed organizer
   * link first. Navigating straight to a members-only /menu/events page causes 403.
   */
  joinWithAccount(): void {
    if (!this.isAuthenticated || !this.guestToken || !this.sessionId
        || this.guestReceipt || this.memberJoining || !this.canRequestParticipation) return;
    this.memberJoining = true;
    this.memberJoinError = '';
    const id = this.sessionId;
    this.http.post<{state:'PARTICIPANT'|'WAITLISTED';waitlistPosition:number|null}>(
      environment.apiUrl + '/api/sessions/' + id + '/guest-join-account',
      {token:this.guestToken}
    ).pipe(timeout(10000),finalize(()=>this.memberJoining=false)).subscribe({
      next: result => {
        if (result.state === 'PARTICIPANT' || result.state === 'WAITLISTED') {
          void this.router.navigate(['/menu/events',id]);
        } else {
          this.memberJoinError='guestRsvp.memberJoinError';
        }
      },
      error: () => {this.memberJoinError='guestRsvp.memberJoinError';}
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
      // An invite can be reused, but a player already booked must never be
      // offered as a new anonymous seat on that invitation.
      this.loadGuestRoster();
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
    // A receipt belongs to one invitation link, not every invite for this session.
    return 'jynlo-guest-receipt:' + this.sessionId + ':' + (this.guestToken || '').slice(0,18);
  }

  private bookingsKey(): string {
    return this.receiptKey() + ':bookings';
  }

  /** Receipt-scoped: never guess the actor from a shared link or a name. */
  private ownCancellationKey(receipt:string): string {
    return this.receiptKey() + ':self-cancelled:' + receipt.slice(0,18);
  }

  private wasCancelledHere(receipt:string): boolean {
    try {
      return !!receipt && /^[A-Za-z0-9_-]{43}$/.test(receipt)
        && localStorage.getItem(this.ownCancellationKey(receipt)) === '1';
    } catch { return false; }
  }

  private loadSavedBookings(): void {
    try {
      const raw=JSON.parse(localStorage.getItem(this.bookingsKey()) || '[]');
      this.guestSavedBookings=Array.isArray(raw)?raw.filter(
        row => typeof row?.receipt==='string' && /^[A-Za-z0-9_-]{43}$/.test(row.receipt)
          && typeof row?.name==='string' && row.name.length<=120
      ).slice(-20):[];
    } catch { this.guestSavedBookings=[]; }
  }

  private rememberGuestBooking(receipt:string,name:string): void {
    if(!/^[A-Za-z0-9_-]{43}$/.test(receipt)) return;
    this.guestSavedBookings=[
      ...this.guestSavedBookings.filter(entry=>entry.receipt!==receipt),
      {receipt,name}
    ].slice(-20);
    try {localStorage.setItem(this.bookingsKey(),JSON.stringify(this.guestSavedBookings));}catch{}
  }

  recoverGuestBooking(receipt:string): void {
    if(this.guestSending || !this.guestSavedBookings.some(entry=>entry.receipt===receipt)) return;
    this.guestReceipt=receipt;
    this.guestCancelledBySelf=this.wasCancelledHere(receipt);
    try{localStorage.setItem(this.receiptKey(),receipt);}catch{}
    this.guestEditingIdentity=false;
    this.guestConfirmCancellation=false;
    this.guestError='';
    this.guestStep='pending';
    this.checkGuestStatus();
  }

  /** Existing visitors may still have a receipt in the pre-fix session-only key. */
  private savedGuestReceipt(): string | null {
    try {
      const scoped = localStorage.getItem(this.receiptKey());
      if (scoped) return scoped;
      const legacyKey = 'jynlo-guest-receipt:' + this.sessionId;
      const legacy = localStorage.getItem(legacyKey);
      if (legacy && /^[A-Za-z0-9_-]{43}$/.test(legacy)) {
        localStorage.setItem(this.receiptKey(), legacy);
        localStorage.removeItem(legacyKey);
      }
      return legacy;
    } catch { return null; }
  }

  /** Correct the identity attached to THIS guest receipt: never create a new seat. */
  startChangingGuestIdentity(): void {
    if (this.guestStep !== 'approved' || !this.guestReceipt) return;
    this.guestEditingIdentity = true;
    this.guestConfirmCancellation = false;
    this.guestPlayerId = null;
    this.guestNewName = '';
    this.guestError = '';
    this.loadGuestRoster();
  }

  cancelChangingGuestIdentity(): void {
    if (this.guestChangingIdentity) return;
    this.guestEditingIdentity = false;
    this.guestPlayerId = null;
    this.guestNewName = '';
    this.guestError = '';
  }

  changeGuestIdentity(): void {
    if (!this.sessionId || !this.guestReceipt || !this.guestEditingIdentity
        || this.guestChangingIdentity || this.guestStep !== 'approved'
        || (!this.guestPlayerId && (this.guestNewName.trim().length < 2
            || this.guestNewName.trim().length > 80))) return;
    const name = this.guestPlayerName;
    this.guestChangingIdentity = true;
    this.guestError = '';
    this.http.post<{status:string;playerName:string;receipt:string}>(
      environment.apiUrl + '/api/sessions/' + this.sessionId + '/guest-requests/change-player',
      {receipt:this.guestReceipt,playerId:this.guestPlayerId,
       newName:this.guestPlayerId===null?this.guestNewName.trim():null}
    ).pipe(timeout(10000),finalize(()=>this.guestChangingIdentity=false)).subscribe({
      next: response => {
        if(response.status!=='APPROVED') {this.guestError='guestRsvp.changeError';return;}
        this.guestConfirmedName = response.playerName?.trim() || name;
        this.rememberGuestBooking(this.guestReceipt,this.guestConfirmedName);
        this.guestEditingIdentity = false;
        this.guestPlayerId = null;
        this.guestNewName = '';
        this.loadConfirmedPlayers();
        this.loadPreview();
        this.loadGuestRoster();
      },
      error: (error: unknown) => {
        this.guestError=error instanceof HttpErrorResponse && error.status===409
          ? 'guestRsvp.changeConflict' : 'guestRsvp.changeError';
        // Never delete the receipt or abandon the reserved seat after a failure.
        this.loadConfirmedPlayers();
      }
    });
  }

  cancelOwnGuestReservation(): void {
    if (!this.sessionId || !this.guestReceipt || this.guestStep!=='approved'
        || !this.guestConfirmCancellation || this.guestCancelling) return;
    this.guestCancelling=true;
    this.guestError='';
    this.http.post<{status:string;playerName?:string}>(
      environment.apiUrl + '/api/sessions/' + this.sessionId + '/guest-requests/cancel-self',
      {receipt:this.guestReceipt}
    ).pipe(timeout(10000),finalize(()=>this.guestCancelling=false)).subscribe({
      next: response => {
        if(response.status !== 'CANCELLED') {this.guestError='guestRsvp.cancelError';return;}
        this.guestStep='cancelled';
        this.guestCancelledBySelf=true;
        try{localStorage.setItem(this.ownCancellationKey(this.guestReceipt),'1');}catch{}
        this.guestSavedBookings=this.guestSavedBookings.filter(
          entry => entry.receipt !== this.guestReceipt);
        try{localStorage.setItem(this.bookingsKey(),JSON.stringify(this.guestSavedBookings));}catch{}
        this.guestConfirmCancellation=false;
        this.guestEditingIdentity=false;
        this.guestMeetingPoint='';
        this.loadConfirmedPlayers();
        this.loadPreview();
        this.loadGuestRoster();
      },
      error:()=>{this.guestError='guestRsvp.cancelError';}
    });
  }

  /** This endpoint checks the signed invitation before revealing participant names. */
  loadConfirmedPlayers(): void {
    if (!this.sessionId || !this.guestToken || this.confirmedPlayersLoading) return;
    this.confirmedPlayersLoading = true;
    this.confirmedPlayersError = false;
    this.http.post<ConfirmedSessionPlayer[]>(
      environment.apiUrl + '/api/sessions/' + this.sessionId + '/guest-confirmed-players',
      {token: this.guestToken}
    ).pipe(timeout(10000),finalize(()=>this.confirmedPlayersLoading=false)).subscribe({
      next: rows => {
        // Never treat malformed API data as legitimate identities.
        this.confirmedPlayers = Array.isArray(rows) ? rows.filter(
          row => typeof row?.key === 'string' && typeof row?.name === 'string'
            && typeof row?.hasAccount === 'boolean') : [];
      },
      error: () => { this.confirmedPlayersError = true; }
    });
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
          const receipt = this.savedGuestReceipt();
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
    this.http.post<{receipt:string;status:string;playerName?:string;meetingPointInstructions?:string|null}>(
      environment.apiUrl + '/api/sessions/' + this.sessionId + '/guest-requests',
      {linkToken:this.guestToken,playerId:this.guestPlayerId,
       newName:this.guestPlayerId===null?this.guestNewName.trim():null,
       note:this.guestNote.trim()}
    ).pipe(timeout(10000),finalize(() => this.guestSending=false)).subscribe({
      next: response => {
        this.guestConfirmedName = response.playerName?.trim() || this.guestPlayerName;
        this.rememberGuestBooking(response.receipt,this.guestConfirmedName);
        this.guestMeetingPoint = response.status === 'APPROVED' &&
          typeof response.meetingPointInstructions === 'string'
          ? response.meetingPointInstructions : '';
        this.guestReceipt = response.receipt;
        this.guestCancelledBySelf=false;
        try {localStorage.setItem(this.receiptKey(),response.receipt);} catch {}
        this.guestStep=response.status==='APPROVED'?'approved':
          response.status==='LINKED'?'linked':'pending';
        // The server has already reserved the seat; refresh the actual capacity.
        this.loadPreview();
      },
      error: (error: unknown) => {
        if (error instanceof HttpErrorResponse && error.status === 409) {
          const booked = this.confirmedPlayers.some(player =>
            !player.hasAccount && player.name.trim().toLocaleLowerCase('pt')
              === this.guestPlayerName.trim().toLocaleLowerCase('pt'));
          this.guestError = booked ? 'guestRsvp.alreadyConfirmed' : 'guestRsvp.conflict';
          this.loadPreview();
        } else {
          this.guestError = 'guestRsvp.requestError';
        }
      }
    });
  }

  checkGuestStatus(): void {
    if (!this.sessionId || !this.guestReceipt || this.guestSending) return;
    this.guestSending=true;
    this.guestError='';
    this.http.post<{status:'PENDING'|'APPROVED'|'REJECTED'|'LINKED'|'CANCELLED';playerName?:string;meetingPointInstructions?:string|null}>(
      environment.apiUrl + '/api/sessions/' + this.sessionId + '/guest-requests/status',
      {receipt:this.guestReceipt}
    ).pipe(timeout(10000),finalize(()=>this.guestSending=false)).subscribe({
      next: r => {
        // The server currently reports CANCELLED without its initiator.
        this.guestCancelledBySelf=r.status==='CANCELLED'
          && this.wasCancelledHere(this.guestReceipt);
        this.guestConfirmedName = r.playerName?.trim() || this.guestConfirmedName;
        if (r.status==='APPROVED' && this.guestConfirmedName) {
          this.rememberGuestBooking(this.guestReceipt,this.guestConfirmedName);
        }
        // The receipt response is authoritative: never cache private arrival
        // instructions, and clear them if removed or the attendance is revoked.
        this.guestMeetingPoint = (r.status === 'APPROVED' || r.status === 'LINKED')
          && typeof r.meetingPointInstructions === 'string'
          ? r.meetingPointInstructions : '';
        if(r.status!=='APPROVED') {
          this.guestEditingIdentity=false;
          this.guestConfirmCancellation=false;
        }
        this.guestStep=r.status==='LINKED'?'linked':
          r.status==='APPROVED'?'approved':
          r.status==='REJECTED'?'rejected':
          r.status==='CANCELLED'?'cancelled':'pending';
      },
      error: (error: unknown) => {
        // A revoked or unknown receipt must not block a different guest on
        // a shared invitation link, particularly after that guest logs in.
        const invalidReceipt = error instanceof HttpErrorResponse
          && [400, 404, 410].includes(error.status);
        if (invalidReceipt) {
          try {
            localStorage.removeItem(this.receiptKey());
            localStorage.removeItem('jynlo-guest-receipt:' + this.sessionId);
          } catch { /* Storage may be disabled. */ }
          this.guestReceipt = '';
          this.guestConfirmedName = '';
          this.guestMeetingPoint = '';
          this.guestCancelledBySelf = false;
          this.guestStep = 'choose';
          this.guestEditingIdentity = false;
          this.guestConfirmCancellation = false;
          this.guestError = '';
          return;
        }
        // A timeout, outage or rate limit does not revoke a valid reservation:
        // keep its receipt and offer another status check, never re-register.
        if (this.guestStep !== 'approved' && this.guestStep !== 'linked') {
          this.guestStep = 'pending';
        }
        this.guestMeetingPoint = '';
        this.guestError = 'guestRsvp.statusError';
      }
    });
  }


  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
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
      this.loadSavedBookings();
      if (!this.isAuthenticated) {
        // Anonymous guests can choose a historical name. Known Jynlo members
        // never see that impersonation-prone selector.
        this.loadGuestRoster();
      } else {
        // After optional sign-up, only a prior private approval receipt
        // authorizes transferring the guest seat to the real account.
        try {
          const receipt = this.savedGuestReceipt();
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
    // Preserve the token through login/sign-up; a community-only session is
    // deliberately NOT readable by an unregistered outsider at /menu/events.
    if (this.guestRegistrationReturnUrl) return this.guestRegistrationReturnUrl;
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
      ? new URL('/sessions/' + this.sessionId
          + (this.guestToken ? '?guest=' + encodeURIComponent(this.guestToken) : ''),
          window.location.origin).href
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

    // The signed POST preview is the only safe way to open a members-only
    // community game without publishing its details on the anonymous GET API.
    const preview$ = this.guestToken
      ? this.http.post<SessionPublicPreview>(
          environment.apiUrl + '/api/sessions/' + this.sessionId + '/guest-preview',
          {token:this.guestToken})
      : this.http.get<SessionPublicPreview>(
          environment.apiUrl + '/api/sessions/' + this.sessionId + '/public-preview');
    preview$.pipe(
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
        if (this.guestToken) this.loadConfirmedPlayers();
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

  /** A signed guest link can reveal the real venue; public discovery remains city-only. */
  get cityMapsUrl(): string | null {
    const place = this.guestToken && this.session?.address?.trim()
      ? this.session.address.trim()
      : this.session?.city?.trim();
    return place ? 'https://www.google.com/maps/search/?api=1&query='
      + encodeURIComponent(place + ', Portugal') : null;
  }

  get exactInvitationLocation(): string | null {
    if (!this.guestToken) return null;
    const venue = this.session?.venueName?.trim();
    const address = this.session?.address?.trim();
    return [venue, address].filter(Boolean).join(' · ') || null;
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
