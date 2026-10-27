import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, OnDestroy } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { JwtHelperService } from '@auth0/angular-jwt';
import { BehaviorSubject, filter, firstValueFrom, Subscription, TimeoutError, timeout } from 'rxjs';
import { Room, RoomEvent } from 'livekit-client';
import { environment } from 'src/environment/environment';
import { DirectCallEvent, DirectChatRealtimeService } from './direct-chat-realtime.service';

export type CallPhase = 'incoming' | 'dialing' | 'connecting' | 'active' | 'error';
export type CallMedia = 'voice' | 'video';
export interface DirectCallState {
  id: string;
  peer: string;
  media: CallMedia;
  phase: CallPhase;
  expiresAt?: number;
  error?: string;
  micEnabled: boolean;
  cameraEnabled: boolean;
}
interface CallSession {
  callId: string;
  peer: string;
  media: CallMedia;
  serverUrl: string;
  token: string;
  expiresAt: string;
}

/**
 * One active private call per browser. Transport is LiveKit WebRTC; the
 * application websocket only carries authenticated invitations and status.
 * Nothing is recorded or persisted by this client.
 */
@Injectable({ providedIn: 'root' })
export class DirectCallClientService implements OnDestroy {
  readonly state$ = new BehaviorSubject<DirectCallState | null>(null);
  readonly available$ = new BehaviorSubject<boolean>(false);
  readonly mediaChanged$ = new BehaviorSubject<number>(0);
  room: Room | null = null;
  private readonly base = environment.apiUrl + '/api/calls/direct';
  private readonly jwt = new JwtHelperService();
  private readonly subscriptions = new Subscription();
  private identityToken: string | null = null;
  private ringTimer?: ReturnType<typeof setTimeout>;
  private generation = 0;
  private checking = false;

  constructor(private readonly http: HttpClient,
              private readonly realtime: DirectChatRealtimeService,
              router: Router) {
    this.subscriptions.add(this.realtime.calls$.subscribe(call => this.onEvent(call)));
    this.subscriptions.add(router.events.pipe(filter(e => e instanceof NavigationEnd))
      .subscribe(() => this.ensureConnected()));
    this.ensureConnected();
    window.addEventListener('storage', this.onStorage);
  }

  private readonly onStorage = (event: StorageEvent): void => {
    if (event.key === 't' || event.key === null) this.ensureConnected();
  };

  /** Both the availability check and the call buttons fail closed. */
  refreshAvailability(): void {
    if (this.checking || !this.username()) return;
    this.checking = true;
    this.http.get<{enabled: boolean}>(this.base + '/availability')
      .pipe(timeout(8000)).subscribe({
        next: result => {
          this.checking = false;
          this.available$.next(result.enabled === true);
        },
        error: () => {
          this.checking = false;
          this.available$.next(false);
        }
      });
  }

  private username(): string {
    try {
      const token = localStorage.getItem('t');
      return token ? String(this.jwt.decodeToken(token)?.sub || '') : '';
    } catch { return ''; }
  }

  ensureConnected(): void {
    const token = localStorage.getItem('t');
    let valid = false;
    try { valid = !!token && !!this.username() && !this.jwt.isTokenExpired(token); }
    catch { valid = false; }
    if (!valid) {
      this.identityToken = null;
      this.available$.next(false);
      this.dropCall();
      return;
    }
    if (this.identityToken && token !== this.identityToken) this.dropCall();
    if (token !== this.identityToken) {
      this.identityToken = token;
      this.available$.next(false);
      this.refreshAvailability();
    }
    this.realtime.connect();
  }

  /**
   * The HTTP signalling step can fail before a LiveKit room is joined.
   * Never collapse 403/409/429/503 into a WebRTC or microphone error.
   * Codes are safe to show: no server internals, peer information or tokens.
   */
  private startFailureMessage(error: unknown): string {
    if (error instanceof TimeoutError) return 'calls.timeout';
    if (!(error instanceof HttpErrorResponse)) return 'calls.unavailable';
    switch (error.status) {
      case 0: return 'calls.networkError';
      case 400: return 'calls.invalidRequest';
      case 401: return 'calls.sessionExpired';
      case 403: return 'calls.notAllowed';
      case 404: return 'calls.notFound';
      case 409: return 'calls.busy';
      case 429: return 'calls.rateLimited';
      case 503: return 'calls.providerUnavailable';
      default: return 'calls.unavailable';
    }
  }

  async start(peer: string, media: CallMedia): Promise<void> {
    if (this.state$.value || !this.available$.value || !peer) return;
    const version = ++this.generation;
    const callerToken = localStorage.getItem('t');
    try {
      const session = await firstValueFrom(this.http.post<CallSession>(
        this.base + '/' + encodeURIComponent(peer), {media}).pipe(timeout(10000)));
      if (version !== this.generation || localStorage.getItem('t') !== callerToken) {
        void this.http.post<void>(this.base + '/' + session.callId + '/end', {}).subscribe({error:()=>{}});
        return;
      }
      this.state$.next({id: session.callId, peer: session.peer, media,
        phase:'dialing', micEnabled:false, cameraEnabled:false,
        expiresAt: Date.parse(session.expiresAt)});
      this.scheduleExpiry(session.callId, Date.parse(session.expiresAt));
      await this.join(session, version);
    } catch (error) {
      if (version === this.generation) {
        this.state$.next({id:'',peer,media,phase:'error',micEnabled:false,
          cameraEnabled:false,error:this.startFailureMessage(error)});
      }
    }
  }

  async accept(): Promise<void> {
    const call=this.state$.value;
    if (!call || call.phase !== 'incoming') return;
    const version=++this.generation;
    this.clearRingTimer();
    this.state$.next({...call,phase:'connecting'});
    try {
      const session=await firstValueFrom(this.http.post<CallSession>(
        this.base + '/' + encodeURIComponent(call.id) + '/accept', {}).pipe(timeout(10000)));
      if (version !== this.generation || this.state$.value?.id !== call.id) return;
      await this.join(session, version);
    } catch (error) {
      if (version === this.generation) {
        this.state$.next({...call,phase:'error',error:this.startFailureMessage(error)});
      }
    }
  }

  decline(): void {
    const call=this.state$.value;
    if (!call || call.phase !== 'incoming') return;
    this.dropCall();
    this.http.post<void>(this.base + '/' + encodeURIComponent(call.id) + '/decline', {})
      .subscribe({error:()=>{}});
  }

  end(): void {
    const call=this.state$.value;
    this.dropCall();
    if (call?.id) {
      this.http.post<void>(this.base + '/' + encodeURIComponent(call.id) + '/end', {})
        .subscribe({error:()=>{}});
    }
  }

  closeError(): void {
    if (this.state$.value?.phase === 'error') this.dropCall();
  }

  async setMicrophone(enabled: boolean): Promise<void> {
    if (!this.room) return;
    try {
      await this.room.localParticipant.setMicrophoneEnabled(enabled);
      this.update({micEnabled:enabled});
    } catch { this.update({error:'calls.mediaError'}); }
  }

  async setCamera(enabled: boolean): Promise<void> {
    if (!this.room || this.state$.value?.media !== 'video') return;
    try {
      await this.room.localParticipant.setCameraEnabled(enabled);
      this.update({cameraEnabled:enabled});
      this.mediaChanged$.next(this.mediaChanged$.value+1);
    } catch { this.update({error:'calls.mediaError'}); }
  }

  async allowAudio(): Promise<void> {
    try { await this.room?.startAudio(); }
    catch { this.update({error:'calls.audioBlocked'}); }
  }

  private async join(session: CallSession, version: number): Promise<void> {
    const room=new Room({adaptiveStream:true,dynacast:true});
    this.room=room;
    room.on(RoomEvent.TrackSubscribed, () => this.mediaChanged$.next(this.mediaChanged$.value+1));
    room.on(RoomEvent.TrackUnsubscribed, () => this.mediaChanged$.next(this.mediaChanged$.value+1));
    room.on(RoomEvent.ParticipantConnected, () => this.update({phase:'active'}));
    room.on(RoomEvent.ParticipantDisconnected, () => this.end());
    room.on(RoomEvent.Disconnected, () => {
      if (this.room===room) this.dropCall();
    });
    try {
      await room.connect(session.serverUrl,session.token,{autoSubscribe:true});
      if (version!==this.generation) {room.disconnect();return;}
      await room.localParticipant.setMicrophoneEnabled(true);
      if (version!==this.generation) {room.disconnect();return;}
      if (session.media==='video') await room.localParticipant.setCameraEnabled(true);
      if (version!==this.generation) {room.disconnect();return;}
      this.update({micEnabled:true,cameraEnabled:session.media==='video'});
      if (room.remoteParticipants.size) this.update({phase:'active'});
      this.mediaChanged$.next(this.mediaChanged$.value+1);
    } catch {
      if (version===this.generation) {
        this.end();
        this.state$.next({id:'',peer:session.peer,media:session.media,
          phase:'error',micEnabled:false,cameraEnabled:false,error:'calls.mediaError'});
      }
    }
  }

  private onEvent(call: DirectCallEvent): void {
    const user=this.username().toLowerCase();
    if (!user || !this.available$.value) return;
    if (call.status==='RINGING') {
      if (call.peer.toLowerCase()!==user || this.state$.value) return;
      const expiresAt=Date.parse(call.expiresAt);
      if (!Number.isFinite(expiresAt) || expiresAt<=Date.now()) return;
      this.state$.next({id:call.callId,peer:call.caller,media:call.media,
        phase:'incoming',expiresAt,micEnabled:false,cameraEnabled:false});
      this.scheduleExpiry(call.callId,expiresAt);
      return;
    }
    const state=this.state$.value;
    if (!state || state.id!==call.callId) return;
    if (call.status==='ACTIVE') {
      if (state.phase!=='incoming' && state.phase!=='error') {
        this.clearRingTimer();
        this.update({phase:'active'});
      } else if (state.phase==='incoming') {
        // Accepted by another device belonging to the same recipient account.
        this.dropCall();
      }
    }
    if (call.status==='DECLINED' || call.status==='ENDED') this.dropCall();
  }

  private scheduleExpiry(id: string, expiresAt: number): void {
    this.clearRingTimer();
    this.ringTimer=setTimeout(() => {
      const state=this.state$.value;
      if (state?.id===id && (state.phase==='incoming' || state.phase==='dialing')) this.end();
    },Math.max(0,expiresAt-Date.now()));
  }

  private clearRingTimer(): void {
    if (this.ringTimer) clearTimeout(this.ringTimer);
    this.ringTimer=undefined;
  }

  private update(patch: Partial<DirectCallState>): void {
    const state=this.state$.value;
    if (state) this.state$.next({...state,...patch});
  }

  private dropCall(): void {
    ++this.generation;
    this.clearRingTimer();
    const room=this.room;
    this.room=null;
    if (room) room.disconnect();
    this.state$.next(null);
    this.mediaChanged$.next(this.mediaChanged$.value+1);
  }

  ngOnDestroy(): void {
    window.removeEventListener('storage',this.onStorage);
    this.subscriptions.unsubscribe();
    this.dropCall();
  }
}
