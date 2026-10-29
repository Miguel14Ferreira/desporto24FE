import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, OnDestroy } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { JwtHelperService } from '@auth0/angular-jwt';
import { BehaviorSubject, filter, firstValueFrom, Subscription, TimeoutError, timeout } from 'rxjs';
import { ConnectionQuality, Room, RoomEvent } from 'livekit-client';
import { environment } from 'src/environment/environment';
import { DirectCallEvent, DirectChatRealtimeService } from './direct-chat-realtime.service';
import { DirectCallToneService } from './direct-call-tone.service';

export type CallPhase = 'incoming' | 'dialing' | 'connecting' | 'active' | 'error';
export type CallMedia = 'voice' | 'video';
export type CallAvailabilityStatus = 'idle' | 'checking' | 'ready' | 'notConfigured'
  | 'invalidCredentials' | 'providerUnavailable' | 'requestFailed';
export interface DirectCallState {
  id: string;
  peer: string;
  media: CallMedia;
  phase: CallPhase;
  expiresAt?: number;
  error?: string;
  micEnabled: boolean;
  cameraEnabled: boolean;
  /** Timestamp is set once when connected, retained across reconnections. */
  startedAt?: number;
}
interface CallSession {
  callId: string;
  peer: string;
  media: CallMedia;
  serverUrl: string;
  token: string;
  expiresAt: string;
}
/** The authenticated pending call response contains no LiveKit credentials. */
interface PendingCallInvitation {
  callId: string;
  caller: string;
  peer: string;
  media: CallMedia;
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
  readonly availabilityStatus$ = new BehaviorSubject<CallAvailabilityStatus>('idle');
  readonly mediaChanged$ = new BehaviorSubject<number>(0);
  /** Only display LiveKit's manual audio-unlock control if autoplay was blocked. */
  readonly audioPlaybackBlocked$ = new BehaviorSubject<boolean>(false);
  readonly ringtoneBlocked$: BehaviorSubject<boolean>;
  readonly devices$ = new BehaviorSubject<MediaDeviceInfo[]>([]);
  readonly selectedDevices$ = new BehaviorSubject<Partial<Record<MediaDeviceKind, string>>>({});
  readonly connectionQuality$ = new BehaviorSubject<'unknown'|'excellent'|'good'|'poor'|'lost'>('unknown');
  readonly busyMedia$ = new BehaviorSubject<boolean>(false);
  room: Room | null = null;
  private readonly base = environment.apiUrl + '/api/calls/direct';
  private readonly jwt = new JwtHelperService();
  private readonly subscriptions = new Subscription();
  private identityToken: string | null = null;
  private ringTimer?: ReturnType<typeof setTimeout>;
  private peerExitTimer?: ReturnType<typeof setTimeout>;
  private refreshingDevices = false;
  private readonly onDevicesChanged = (): void => { void this.refreshDevices(); };
  private generation = 0;
  private checking = false;
  private recoveringPending = false;
  private pendingTimer?: ReturnType<typeof setInterval>;
  private readonly onForeground = (): void => {
    if (document.visibilityState === 'visible') this.recoverPendingCall();
  };

  constructor(private readonly http: HttpClient,
              private readonly realtime: DirectChatRealtimeService,
              router: Router,
              private readonly tones: DirectCallToneService) {
    this.ringtoneBlocked$ = tones.needsGesture$;
    this.subscriptions.add(this.state$.subscribe(call => this.tones.sync(call?.phase)));
    this.subscriptions.add(this.realtime.calls$.subscribe(call => this.onEvent(call)));
    this.subscriptions.add(router.events.pipe(filter(e => e instanceof NavigationEnd))
      .subscribe(() => this.ensureConnected()));
    this.ensureConnected();
    window.addEventListener('storage', this.onStorage);
    window.addEventListener('focus', this.onForeground);
    document.addEventListener('visibilitychange', this.onForeground);
    navigator.mediaDevices?.addEventListener?.('devicechange', this.onDevicesChanged);
    // Recover RINGING invitations even if the socket dropped the event.
    this.pendingTimer = setInterval(() => this.recoverPendingCall(), 8_000);
    if (this.realtime.connected$) {
      this.subscriptions.add(this.realtime.connected$.subscribe(connected => {
        if (connected) this.recoverPendingCall();
      }));
    }
  }

  private readonly onStorage = (event: StorageEvent): void => {
    if (event.key === 't' || event.key === null) this.ensureConnected();
  };

  /** Both the availability check and the call buttons fail closed. */
  refreshAvailability(): void {
    if (this.checking) return;
    const token = localStorage.getItem('t');
    if (!token || !this.username()) {
      this.available$.next(false);
      this.availabilityStatus$.next('idle');
      return;
    }
    this.checking = true;
    this.available$.next(false);
    this.availabilityStatus$.next('checking');
    this.http.get<{enabled: boolean; status?: string}>(this.base + '/availability')
      .pipe(timeout(8000)).subscribe({
        next: result => {
          this.checking = false;
          if (localStorage.getItem('t') !== token) return;
          const ready = result.enabled === true;
          this.available$.next(ready);
          const status: CallAvailabilityStatus = ready ? 'ready'
            : result.status === 'invalidCredentials' ? 'invalidCredentials'
            : result.status === 'providerUnavailable' ? 'providerUnavailable'
            : 'notConfigured';
          this.availabilityStatus$.next(status);
        },
        error: () => {
          this.checking = false;
          if (localStorage.getItem('t') !== token) return;
          this.available$.next(false);
          this.availabilityStatus$.next('requestFailed');
        }
      });
  }

  /** Read-only recovery: never starts a second call or exposes room tokens. */
  recoverPendingCall(): void {
    if (this.recoveringPending || this.state$.value || !this.available$.value
        || document.visibilityState === 'hidden') return;
    const username = this.username().toLowerCase();
    const token = localStorage.getItem('t');
    if (!username || !token) return;
    this.recoveringPending = true;
    this.http.get<PendingCallInvitation | null>(this.base + '/pending')
      .pipe(timeout(8000)).subscribe({
        next: invite => {
          this.recoveringPending = false;
          if (localStorage.getItem('t') !== token || !this.available$.value
              || this.state$.value || !invite
              || typeof invite.callId !== 'string'
              || typeof invite.caller !== 'string'
              || typeof invite.peer !== 'string'
              || invite.peer.toLowerCase() !== username
              || !['voice', 'video'].includes(invite.media)) return;
          this.onEvent({...invite,status:'RINGING',actor:invite.caller});
        },
        error: () => { this.recoveringPending = false; }
      });
  }

  private subjectFor(token: string | null): string {
    try { return token ? String(this.jwt.decodeToken(token)?.sub || '').toLowerCase() : ''; }
    catch { return ''; }
  }

  private username(): string {
    return this.subjectFor(localStorage.getItem('t'));
  }

  ensureConnected(): void {
    const token = localStorage.getItem('t');
    let valid = false;
    try { valid = !!token && !!this.username() && !this.jwt.isTokenExpired(token); }
    catch { valid = false; }
    if (!valid) {
      this.identityToken = null;
      this.available$.next(false);
      this.availabilityStatus$.next('idle');
      this.dropCall();
      return;
    }
    if (this.identityToken && token !== this.identityToken
        && this.subjectFor(token) !== this.subjectFor(this.identityToken)) {
      this.dropCall();
    }
    if (token !== this.identityToken) {
      // Refreshing an access JWT for the same account must not hang up a
      // LiveKit room or invalidate an in-flight outgoing call.
      const ongoing = !!this.state$.value;
      this.identityToken = token;
      if (!ongoing) {
        this.available$.next(false);
        this.availabilityStatus$.next('idle');
        this.refreshAvailability();
      }
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
      case 500:
      case 502:
      case 504: return 'calls.serverError';
      default: return 'calls.unavailable';
    }
  }

  async start(peer: string, media: CallMedia): Promise<void> {
    if (this.state$.value || !this.available$.value || !peer) return;
    // Unlock Web Audio while the outgoing call click still has user activation;
    // the HTTP response and subsequent LiveKit connect are asynchronous.
    this.tones.prime();
    const version = ++this.generation;
    const callerToken = localStorage.getItem('t');
    try {
      const session = await firstValueFrom(this.http.post<CallSession>(
        this.base + '/' + encodeURIComponent(peer), {media}).pipe(timeout(10000)));
      if (version !== this.generation
          || this.subjectFor(localStorage.getItem('t')) !== this.subjectFor(callerToken)) {
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
    const room=this.room;
    if (!room) return;
    try {
      await room.localParticipant.setMicrophoneEnabled(enabled);
      if (room === this.room) this.update({micEnabled:enabled,error:undefined});
    } catch (error) {
      if (room === this.room) this.update({error:this.mediaFailure(error,'microphone')});
    }
    void this.refreshDevices();
  }

  /** Device labels are revealed only when the browser grants permission. */
  async refreshDevices(): Promise<void> {
    if (this.refreshingDevices || !this.room || !navigator.mediaDevices?.enumerateDevices) return;
    const room=this.room;
    this.refreshingDevices=true;
    try {
      const devices=await navigator.mediaDevices.enumerateDevices();
      if (room !== this.room) return;
      this.devices$.next(devices.filter(d => ['videoinput','audioinput','audiooutput'].includes(d.kind)));
      const selected={...this.selectedDevices$.value};
      for (const kind of ['videoinput','audioinput','audiooutput'] as MediaDeviceKind[]) {
        if (selected[kind] && !devices.some(d=>d.kind===kind && d.deviceId===selected[kind])) {
          delete selected[kind];
        }
      }
      this.selectedDevices$.next(selected);
    } catch {
      // Enumerating media devices is optional and may be blocked by policy.
    } finally {
      this.refreshingDevices=false;
    }
  }

  /** Translate native browser/LiveKit errors into actionable PT/EN i18n codes. */
  private mediaFailure(error: unknown, kind: 'camera'|'microphone'): string {
    const name=error && typeof error==='object' && 'name' in error
      ? String((error as {name:unknown}).name) : '';
    const prefix=kind==='camera' ? 'calls.camera' : 'calls.microphone';
    if (['NotAllowedError','PermissionDeniedError','SecurityError'].includes(name)) return prefix+'Denied';
    if (['NotFoundError','DevicesNotFoundError'].includes(name)) return prefix+'Missing';
    if (['NotReadableError','TrackStartError'].includes(name)) return prefix+'Busy';
    if (['OverconstrainedError','ConstraintNotSatisfiedError'].includes(name)) return prefix+'InvalidDevice';
    return kind==='camera' ? 'calls.cameraAccessError' : 'calls.microphoneAccessError';
  }

  /**
   * Always try the system camera first, without a stale persisted deviceId.
   * If it is missing or unavailable, try one of the enumerated alternatives.
   * Never silently retry permission denial (browser requires user action).
   */
  async setCamera(enabled: boolean): Promise<void> {
    const room=this.room;
    if (!room || this.state$.value?.media!=='video' || this.busyMedia$.value) return;
    this.busyMedia$.next(true);
    try {
      if (!enabled) {
        await room.localParticipant.setCameraEnabled(false);
      } else {
        try {
          await room.localParticipant.setCameraEnabled(true);
        } catch (primary) {
          const code=this.mediaFailure(primary,'camera');
          if (code==='calls.cameraDenied') throw primary;
          let recovered=false;
          const devices=this.devices$.value.filter(d=>d.kind==='videoinput' && d.deviceId && d.deviceId!=='default');
          for (const device of devices.slice(0,3)) {
            if (room!==this.room) return;
            try {
              await room.localParticipant.setCameraEnabled(true,{deviceId:{exact:device.deviceId}});
              this.selectedDevices$.next({...this.selectedDevices$.value,videoinput:device.deviceId});
              recovered=true;break;
            } catch { /* try another available camera */ }
          }
          if (!recovered) throw primary;
        }
      }
      if (room===this.room) {
        this.update({cameraEnabled:enabled,error:undefined});
        this.mediaChanged$.next(this.mediaChanged$.value+1);
      }
    } catch (error) {
      if (room===this.room) this.update({cameraEnabled:false,error:this.mediaFailure(error,'camera')});
    } finally {
      this.busyMedia$.next(false);
      void this.refreshDevices();
    }
  }

  async selectDevice(kind: MediaDeviceKind, deviceId: string): Promise<void> {
    const room=this.room;
    if (!room || this.busyMedia$.value || !['videoinput','audioinput','audiooutput'].includes(kind)) return;
    // A client supplied ID cannot select a device which has disappeared.
    if (!this.devices$.value.some(d=>d.deviceId===deviceId && d.kind===kind)) {
      this.update({error:'calls.deviceMissing'});
      void this.refreshDevices();
      return;
    }
    this.busyMedia$.next(true);
    try {
      if (kind==='videoinput' && !this.state$.value?.cameraEnabled) {
        await room.localParticipant.setCameraEnabled(true,{deviceId:{exact:deviceId}});
        if (room===this.room) this.update({cameraEnabled:true,error:undefined});
      } else if (kind==='audioinput' && !this.state$.value?.micEnabled) {
        await room.localParticipant.setMicrophoneEnabled(true,{deviceId:{exact:deviceId}});
        if (room===this.room) this.update({micEnabled:true,error:undefined});
      } else {
        const switched=await room.switchActiveDevice(kind,deviceId);
        if (!switched) throw new DOMException('Device was not switched','NotReadableError');
      }
      if (room===this.room) {
        this.selectedDevices$.next({...this.selectedDevices$.value,[kind]:deviceId});
        this.update({error:undefined});
        this.mediaChanged$.next(this.mediaChanged$.value+1);
      }
    } catch (error) {
      if (room===this.room) this.update({error:kind==='videoinput'
        ? this.mediaFailure(error,'camera')
        : kind==='audioinput' ? this.mediaFailure(error,'microphone')
        : 'calls.speakerUnavailable'});
    } finally {
      this.busyMedia$.next(false);
      void this.refreshDevices();
    }
  }

  async allowAudio(): Promise<void> {
    const room = this.room;
    if (!room) return;
    try {
      // Must be initiated by the actual button click, not a later promise.
      await room.startAudio();
      if (this.room === room) {
        this.audioPlaybackBlocked$.next(room.canPlaybackAudio === false);
        this.update({error: undefined});
      }
    } catch {
      if (this.room === room) {
        this.audioPlaybackBlocked$.next(true);
        this.update({error:'calls.audioBlocked'});
      }
    }
  }

  allowRingtone(): void {
    this.tones.prime();
  }

  /** Factory for deterministic LiveKit integration tests without real hardware. */
  private createRoom(): Room {
    return new Room({adaptiveStream:true,dynacast:true});
  }

  /**
   * Keep the real error visible when LiveKit fails. end() used to clear the
   * overlay and the echoed ENDED event hid the explanation milliseconds later.
   */
  private failConnection(session: CallSession, version: number, message: string): void {
    if (version !== this.generation) return;
    ++this.generation;
    this.clearRingTimer();
    this.clearPeerExitTimer();
    const room=this.room;
    this.room=null; // suppress Disconnected callback triggered by our cleanup
    if (room) void room.disconnect();
    this.state$.next({id:session.callId,peer:session.peer,media:session.media,
      phase:'error',micEnabled:false,cameraEnabled:false,error:message});
    this.mediaChanged$.next(this.mediaChanged$.value+1);
    // Release the server-side call. Even if signalling fails, keep error
    // explanation visible until the user explicitly closes the dialog.
    this.http.post<void>(this.base + '/' + encodeURIComponent(session.callId) + '/end', {})
      .subscribe({error:()=>{}});
  }

  private async join(session: CallSession, version: number): Promise<void> {
    const room=this.createRoom();
    this.room=room;
    room.on(RoomEvent.TrackSubscribed, () => this.mediaChanged$.next(this.mediaChanged$.value+1));
    room.on(RoomEvent.ConnectionQualityChanged, (quality, participant) => {
      if (room!==this.room || participant!==room.localParticipant) return;
      const status=quality===ConnectionQuality.Excellent ? 'excellent'
        : quality===ConnectionQuality.Good ? 'good'
        : quality===ConnectionQuality.Poor ? 'poor'
        : quality===ConnectionQuality.Lost ? 'lost' : 'unknown';
      this.connectionQuality$.next(status);
    });
    room.on(RoomEvent.AudioPlaybackStatusChanged, () => {
      if (this.room === room)
        this.audioPlaybackBlocked$.next(room.canPlaybackAudio === false);
    });
    room.on(RoomEvent.TrackUnsubscribed, () => this.mediaChanged$.next(this.mediaChanged$.value+1));
    room.on(RoomEvent.ParticipantConnected, () => {
      if (this.room===room && version===this.generation) {
        this.clearPeerExitTimer();
        this.update({phase:'active'});
      }
    });
    room.on(RoomEvent.ParticipantDisconnected, () => {
      if (this.room!==room || version!==this.generation) return;
      // LiveKit also emits this event when a peer performs a full WebRTC
      // reconnect. Don't terminate the server call before it rejoins.
      this.clearPeerExitTimer();
      this.update({phase:'connecting'});
      this.peerExitTimer=setTimeout(() => {
        this.peerExitTimer=undefined;
        if (this.room===room && version===this.generation
            && room.remoteParticipants.size===0)
          this.failConnection(session,version,'calls.peerDisconnected');
      },20_000);
    });
    room.on(RoomEvent.Reconnecting, () => {
      if (this.room===room && version===this.generation) this.update({phase:'connecting'});
    });
    room.on(RoomEvent.Reconnected, () => {
      if (this.room===room && version===this.generation && room.remoteParticipants.size>0)
        this.update({phase:'active'});
    });
    room.on(RoomEvent.Disconnected, () => {
      if (this.room===room) this.failConnection(session,version,'calls.connectionLost');
    });
    try {
      await room.connect(session.serverUrl,session.token,{autoSubscribe:true});
    } catch {
      this.failConnection(session,version,'calls.connectionFailed');
      return;
    }
    if (version!==this.generation) {void room.disconnect();return;}
    this.audioPlaybackBlocked$.next(room.canPlaybackAudio === false);
    void this.refreshDevices();
    // Microphone/camera permission failures should not end an established
    // room: stay connected as listener and let the user retry the devices.
    let micEnabled=false;
    let cameraEnabled=false;
    try {
      await room.localParticipant.setMicrophoneEnabled(true);
      micEnabled=true;
    } catch {
      if (version===this.generation) this.update({error:'calls.microphoneAccessError'});
    }
    if (version!==this.generation) {void room.disconnect();return;}
    if (session.media==='video') {
      // Reuse the same safe fallback and browser-specific diagnostics as the
      // in-call Retry camera control, instead of a separate fragile path.
      this.update({micEnabled,error:undefined});
      await this.setCamera(true);
      cameraEnabled=this.state$.value?.cameraEnabled === true;
    }
    if (version!==this.generation) {void room.disconnect();return;}
    this.update({micEnabled:micEnabled,cameraEnabled:cameraEnabled});
    if (room.remoteParticipants.size) this.update({phase:'active'});
    this.mediaChanged$.next(this.mediaChanged$.value+1);
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
    if (call.status==='DECLINED' || call.status==='ENDED') {
      // A late server echo must not hide a locally detected connection error.
      if (state.phase!=='error') this.dropCall();
    }
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

  private clearPeerExitTimer(): void {
    if (this.peerExitTimer) clearTimeout(this.peerExitTimer);
    this.peerExitTimer=undefined;
  }

  private update(patch: Partial<DirectCallState>): void {
    const state=this.state$.value;
    if (state) {
      const startedAt=patch.phase==='active' ? (state.startedAt || Date.now()) : state.startedAt;
      this.state$.next({...state,...patch,startedAt});
    }
  }

  private dropCall(): void {
    ++this.generation;
    this.clearRingTimer();
    this.clearPeerExitTimer();
    const room=this.room;
    this.room=null;
    if (room) room.disconnect();
    this.state$.next(null);
    this.audioPlaybackBlocked$.next(false);
    this.devices$.next([]);
    this.selectedDevices$.next({});
    this.connectionQuality$.next('unknown');
    this.busyMedia$.next(false);
    this.mediaChanged$.next(this.mediaChanged$.value+1);
  }

  ngOnDestroy(): void {
    window.removeEventListener('storage',this.onStorage);
    window.removeEventListener('focus',this.onForeground);
    document.removeEventListener('visibilitychange',this.onForeground);
    navigator.mediaDevices?.removeEventListener?.('devicechange',this.onDevicesChanged);
    if (this.pendingTimer) clearInterval(this.pendingTimer);
    this.subscriptions.unsubscribe();
    this.dropCall();
  }
}
