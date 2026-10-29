import { AfterViewChecked, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Track } from 'livekit-client';
import { combineLatest, map, Observable, Subscription, timer } from 'rxjs';
import { TranslatePipe } from '../i18n/translate.pipe';
import { DirectCallClientService } from '../services/direct-call-client.service';

/**
 * Compact, responsive call surface with persistent call controls, a duration
 * clock, connection diagnostics and in-call media device recovery.
 */
@Component({
  selector: 'app-direct-call-overlay',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  template: `
    @if (calls.state$ | async; as call) {
      <section class="call-backdrop" role="dialog" aria-modal="true"
          [attr.aria-label]="'calls.title' | t" (keydown.escape)="dismiss()">
        <div class="call-panel" tabindex="-1">
          <header class="call-topline">
            <strong class="call-brand">Jynlo <span class="call-brand-dot">●</span></strong>
            <span class="call-kind">{{ (call.media === 'video' ? 'calls.video' : 'calls.voice') | t }}</span>
          </header>
          <div class="call-info">
            <div class="call-avatar" aria-hidden="true">{{ call.peer.slice(0,1).toUpperCase() }}</div>
            <div class="call-summary">
              <h2>{{ call.peer }}</h2>
              <p class="call-phase" role="status">
                <span class="call-status-dot" [class.call-status-connected]="call.phase === 'active'"></span>
                {{ (call.phase === 'incoming' ? 'calls.incoming' :
                  call.phase === 'dialing' ? 'calls.ringing' :
                  call.phase === 'connecting' ? (call.startedAt ? 'calls.reconnecting' : 'calls.connecting') :
                  call.phase === 'error' ? 'calls.connectionLost' : 'calls.connected') | t }}
              </p>
            </div>
          </div>
          @if (call.phase !== 'error' && call.phase !== 'incoming') {
            <div class="call-metrics">
              <span class="call-metric" aria-label="Duração">
                <span aria-hidden="true">◷</span> {{ (elapsed$ | async) || '00:00' }}
              </span>
              <span class="call-metric call-quality" [class.is-poor]="(calls.connectionQuality$ | async) === 'poor' || (calls.connectionQuality$ | async) === 'lost'">
                <span aria-hidden="true">▰</span>
                {{ (qualityKey(calls.connectionQuality$ | async) | t) }}
              </span>
              <span class="call-metric">{{ 'calls.participants' | t }}: {{ participantCount }}</span>
            </div>
          }
          @if (call.media === 'video' && call.phase !== 'incoming' && call.phase !== 'error') {
            <div class="call-videos" [class.call-videos--swapped]="viewsSwapped">
              <button type="button" class="call-swap" (click)="viewsSwapped=!viewsSwapped"
                [disabled]="!remoteHasVideo || !call.cameraEnabled">⇄ {{ 'calls.swapView' | t }}</button>
              <video #remoteVideo autoplay playsinline [attr.aria-label]="'calls.remoteVideo' | t"></video>
              @if (!remoteHasVideo) {
                <div class="call-remote-placeholder">
                  <span class="call-avatar call-avatar-remote" aria-hidden="true">{{ call.peer.slice(0,1).toUpperCase() }}</span>
                  <p>{{ 'calls.waitingForVideo' | t }}</p>
                </div>
              }
              @if (call.cameraEnabled) {
                <video #localVideo autoplay playsinline muted [attr.aria-label]="'calls.localVideo' | t"></video>
              } @else {
                <div class="call-local-off">
                  <span aria-hidden="true">◉</span>
                  <small>{{ 'calls.cameraIsOff' | t }}</small>
                </div>
              }
            </div>
          } @else if (call.phase !== 'error') {
            <div class="call-voice-surface" [class.is-active]="call.phase === 'active'">
              <span class="call-avatar call-avatar-large" aria-hidden="true">{{ call.peer.slice(0,1).toUpperCase() }}</span>
              <p>{{ call.phase === 'incoming' ? ('calls.incoming' | t) : ('calls.voiceConnected' | t) }}</p>
            </div>
          }
          @if (call.phase !== 'error') { <audio #remoteAudio autoplay></audio> }
          <div class="call-feedback" aria-live="polite">
            @if (call.error) {
              <p class="call-error" role="alert">{{ call.error | t }}</p>
              @if (call.media === 'video' && !call.cameraEnabled && call.phase !== 'error') {
                <div class="call-recovery-actions">
                  <button type="button" class="call-retry" [disabled]="calls.busyMedia$ | async"
                    (click)="calls.setCamera(true)">{{ 'calls.retryCamera' | t }}</button>
                  <button type="button" class="call-retry" [disabled]="calls.busyMedia$ | async"
                    (click)="toggleSettings(true)">{{ 'calls.chooseCamera' | t }}</button>
                </div>
              }
            }
            @if ((call.phase === 'incoming' || call.phase === 'dialing')
                  && (calls.ringtoneBlocked$ | async)) {
              <p class="call-audio-help" role="status">{{ 'calls.ringtoneBlocked' | t }}</p>
            }
          </div>
          <footer class="call-footer">
            <div class="call-buttons">
              @if ((call.phase === 'incoming' || call.phase === 'dialing')
                    && (calls.ringtoneBlocked$ | async)) {
                <button type="button" class="call-enable-sound" (click)="calls.allowRingtone()">
                  {{ 'calls.enableRingtone' | t }}
                </button>
              }
              @if (call.phase === 'incoming') {
                <button type="button" class="call-decline" (click)="calls.decline()">
                  <span aria-hidden="true">✕</span> {{ 'calls.decline' | t }}
                </button>
                <button type="button" class="call-accept" (click)="calls.accept()">
                  <span aria-hidden="true">✓</span> {{ 'calls.accept' | t }}
                </button>
              } @else if (call.phase === 'error') {
                <button type="button" class="call-decline" (click)="calls.closeError()">
                  {{ 'calls.close' | t }}
                </button>
              } @else {
                <button type="button" (click)="calls.setMicrophone(!call.micEnabled)"
                  [attr.aria-pressed]="!call.micEnabled" [class.call-off]="!call.micEnabled">
                  <span aria-hidden="true">{{ call.micEnabled ? '🎙' : '⊘' }}</span>
                  {{ (call.micEnabled ? 'calls.mute' : 'calls.unmute') | t }}
                </button>
                @if (call.media === 'video') {
                  <button type="button" [disabled]="calls.busyMedia$ | async"
                    (click)="calls.setCamera(!call.cameraEnabled)"
                    [attr.aria-pressed]="!call.cameraEnabled" [class.call-off]="!call.cameraEnabled">
                    <span aria-hidden="true">▣</span>
                    {{ (call.cameraEnabled ? 'calls.cameraOff' : 'calls.cameraOn') | t }}
                  </button>
                }
                @if (calls.canShareScreen) {
                  <button type="button" [disabled]="calls.busyMedia$ | async"
                    (click)="calls.setScreenShare(!(calls.screenShareEnabled$ | async))"
                    [attr.aria-pressed]="calls.screenShareEnabled$ | async">
                    <span aria-hidden="true">▧</span>
                    {{ ((calls.screenShareEnabled$ | async) ? 'calls.stopSharing' : 'calls.shareScreen') | t }}
                  </button>
                }
                @if (calls.audioPlaybackBlocked$ | async) {
                  <button type="button" class="call-enable-sound" (click)="calls.allowAudio()">
                    {{ 'calls.sound' | t }}
                  </button>
                }
                <button type="button" class="call-settings-button"
                  [attr.aria-expanded]="settingsOpen" (click)="toggleSettings()">
                  <span aria-hidden="true">⚙</span> {{ 'calls.settings' | t }}
                </button>
                <button type="button" class="call-decline" (click)="calls.end()">
                  <span aria-hidden="true">✕</span> {{ 'calls.hangUp' | t }}
                </button>
              }
            </div>
            @if (settingsOpen && call.phase !== 'incoming' && call.phase !== 'error') {
              <div class="call-device-panel" role="group" [attr.aria-label]="'calls.settings' | t">
                <div class="call-settings-head">
                  <strong>{{ 'calls.devices' | t }}</strong>
                  <button type="button" class="call-scan" (click)="calls.refreshDevices()">
                    {{ 'calls.rescan' | t }}
                  </button>
                </div>
                @if (calls.devices$ | async; as devices) {
                  @if (call.media === 'video') {
                    <label for="call-camera">{{ 'calls.cameraDevice' | t }}</label>
                    <select id="call-camera" [disabled]="calls.busyMedia$ | async"
                      (change)="selectDevice('videoinput', $event)">
                      <option value="">{{ 'calls.selectDevice' | t }}</option>
                      @for (device of devices; track device.deviceId) {
                        @if (device.kind === 'videoinput') {
                          <option [value]="device.deviceId" [selected]="(calls.selectedDevices$ | async)?.videoinput === device.deviceId">
                            {{ device.label || ('calls.cameraDevice' | t) + ' ' + ($index+1) }}
                          </option>
                        }
                      }
                    </select>
                  }
                  <label for="call-microphone">{{ 'calls.microphoneDevice' | t }}</label>
                  <select id="call-microphone" [disabled]="calls.busyMedia$ | async"
                    (change)="selectDevice('audioinput', $event)">
                    <option value="">{{ 'calls.selectDevice' | t }}</option>
                    @for (device of devices; track device.deviceId) {
                      @if (device.kind === 'audioinput') {
                        <option [value]="device.deviceId" [selected]="(calls.selectedDevices$ | async)?.audioinput === device.deviceId">
                          {{ device.label || ('calls.microphoneDevice' | t) + ' ' + ($index+1) }}
                        </option>
                      }
                    }
                  </select>
                  @if (speakerSelectionSupported) {
                  <label for="call-speaker">{{ 'calls.speakerDevice' | t }}</label>
                  <select id="call-speaker" [disabled]="calls.busyMedia$ | async"
                    (change)="selectDevice('audiooutput', $event)">
                    <option value="">{{ 'calls.selectDevice' | t }}</option>
                    @for (device of devices; track device.deviceId) {
                      @if (device.kind === 'audiooutput') {
                        <option [value]="device.deviceId" [selected]="(calls.selectedDevices$ | async)?.audiooutput === device.deviceId">
                          {{ device.label || ('calls.speakerDevice' | t) + ' ' + ($index+1) }}
                        </option>
                      }
                    }
                  </select>
                }
                  }
                <p>{{ 'calls.devicesHelp' | t }}</p>
              </div>
            }
          </footer>
          <span class="call-refresh" aria-hidden="true">{{ calls.mediaChanged$ | async }}</span>
        </div>
      </section>
    }
  `,
  styles: [`
    :host{display:contents}
    .call-backdrop{position:fixed;inset:0;z-index:6000;display:grid;place-items:center;
      padding:clamp(8px,2vh,24px);background:rgba(0,13,23,.9);backdrop-filter:blur(8px);}
    .call-panel{box-sizing:border-box;width:min(100%,900px);max-height:calc(100dvh - 20px);
      display:flex;flex-direction:column;min-height:0;padding:clamp(12px,2vw,22px);
      color:#ecfcf9;background:linear-gradient(144deg,#0b2332,#133e49);
      border:1px solid rgba(104,201,198,.43);border-radius:22px;
      box-shadow:0 20px 90px rgba(0,0,0,.55);overflow:hidden;}
    .call-topline,.call-info,.call-metrics,.call-buttons,.call-settings-head{
      display:flex;align-items:center;justify-content:space-between;gap:10px}
    .call-topline{color:#8ee9d5;font-size:.78rem;font-weight:850}
    .call-brand-dot{font-size:.62rem;color:#4de3be}
    .call-kind{color:#e0eef4;font-weight:650}
    .call-info{justify-content:center;gap:12px;margin:8px 0 2px;min-height:55px}
    .call-avatar{display:grid;place-items:center;flex:0 0 auto;width:50px;height:50px;
      border-radius:50%;background:#276b68;color:#e0fff8;font-size:1.25rem;font-weight:850}
    .call-summary{min-width:0;text-align:left}
    .call-summary h2{font-size:clamp(1.12rem,2.2vw,1.42rem);margin:0 0 4px;overflow-wrap:anywhere}
    .call-phase{display:flex;gap:8px;align-items:center;margin:0;font-size:.8rem;color:#bbd5db}
    .call-status-dot{width:7px;height:7px;flex:0 0 auto;border-radius:50%;background:#f5b75d}
    .call-status-connected{background:#57edc2}
    .call-metrics{justify-content:center;gap:6px;flex-wrap:wrap;margin:9px 0 10px}
    .call-metric{display:inline-flex;gap:6px;align-items:center;padding:5px 10px;
      font-size:.77rem;border:1px solid #375b66;border-radius:99px;color:#cde8e9;
      background:rgba(5,26,38,.65);font-variant-numeric:tabular-nums;}
    .call-quality.is-poor{color:#ffd3aa;border-color:#b16b46}
    .call-videos{position:relative;flex:1 1 auto;min-height:150px;max-height:min(55dvh,480px);
      overflow:hidden;background:#081b28;border-radius:16px;margin-bottom:10px;}
    .call-videos video:first-child{display:block;width:100%;height:100%;min-height:150px;
      max-height:min(55dvh,480px);object-fit:cover;background:#0a1d29;}
    .call-videos video:nth-of-type(2){position:absolute;right:12px;bottom:12px;
      width:clamp(76px,18%,142px);height:clamp(90px,22%,165px);min-height:100px;
      object-fit:cover;border-radius:12px;border:1px solid #9be8d8;background:#1d4955;
      transform:scaleX(-1);z-index:2;box-shadow:0 3px 14px #07171c;}
    .call-remote-placeholder{position:absolute;inset:0;display:grid;place-content:center;
      justify-items:center;gap:8px;pointer-events:none;color:#b4d9dd;font-size:.86rem}
    .call-remote-placeholder p{margin:0}
    .call-avatar-remote{width:72px;height:72px;font-size:1.7rem}
    .call-local-off{position:absolute;right:12px;bottom:12px;width:clamp(76px,18%,142px);
      height:clamp(90px,22%,165px);min-height:100px;border-radius:12px;
      border:1px solid #6a999f;background:#163a46;z-index:2;display:grid;
      place-content:center;justify-items:center;gap:5px;color:#c4e3e9;font-size:1.2rem}
    .call-local-off small{font-size:.65rem}
    .call-voice-surface{display:grid;justify-items:center;align-content:center;gap:8px;
      min-height:160px;color:#c4d9da}
    .call-avatar-large{width:94px;height:94px;font-size:2.2rem}
    .call-voice-surface p{margin:0;font-size:.83rem}
    .call-feedback{flex:0 0 auto;display:grid;justify-items:center}
    .call-error{color:#ffc2c1;font-size:.82rem;line-height:1.35;text-align:center;margin:3px 0 6px}
    .call-retry,.call-enable-sound{border:1px solid #5ec2d1;background:#175e73;color:#e5faff;
      padding:7px 12px;border-radius:9px;font:inherit;font-size:.78rem;cursor:pointer}
    .call-audio-help{color:#f2dfb4;font-size:.77rem;text-align:center;margin:3px 0 8px}
    .call-footer{flex:0 0 auto;min-height:0}
    .call-buttons{justify-content:center;flex-wrap:wrap;gap:7px;padding:8px 0 0}
    .call-buttons button{display:inline-flex;align-items:center;justify-content:center;gap:7px;
      padding:10px 13px;min-height:43px;border-radius:11px;
      border:1px solid #427871;background:#1c5654;color:#ecfff8;
      cursor:pointer;font:inherit;font-size:.83rem;font-weight:650}
    .call-buttons button:hover,.call-retry:hover{filter:brightness(1.16)}
    .call-buttons button:disabled,.call-retry:disabled{opacity:.5;cursor:wait}
    .call-buttons button:focus-visible,.call-device-panel :is(button,select):focus-visible{
      outline:2px solid #83ffdf;outline-offset:3px}
    .call-buttons .call-off{background:#284b59;border-color:#4e8192}
    .call-buttons .call-decline{background:#923d49;border-color:#d57780;color:white}
    .call-buttons .call-accept{background:#127e61;border-color:#26dfad}
    .call-buttons .call-settings-button{background:#183c51;border-color:#4c8393}
    .call-device-panel{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));
      gap:6px 12px;margin-top:9px;padding:12px;max-height:29dvh;overflow-y:auto;
      background:rgba(6,28,42,.92);border:1px solid #416b77;border-radius:12px}
    .call-settings-head{grid-column:1/-1}
    .call-settings-head strong{font-size:.84rem}
    .call-scan{border:1px solid #4c8691;color:#aeeadf;background:#153a48;
      border-radius:8px;padding:6px 9px;cursor:pointer}
    .call-device-panel label{font-size:.76rem;color:#b6d7dc;align-self:end}
    .call-device-panel select{grid-row:3;min-width:0;width:100%;font:inherit;font-size:.78rem;
      background:#133748;color:#f4fffe;border:1px solid #547e8a;border-radius:9px;padding:9px}
    .call-device-panel p{grid-column:1/-1;color:#b1d2da;font-size:.71rem;margin:0}
    .call-swap{position:absolute;top:10px;right:10px;z-index:5;background:#092b38de;
      border:1px solid #66a9a0;color:#e1fffa;border-radius:10px;padding:7px 11px;cursor:pointer;font-size:.78rem}
    .call-swap:disabled{opacity:.4;cursor:default}
    .call-videos--swapped video:first-child{position:absolute;right:12px;bottom:12px;
      width:clamp(76px,18%,142px);height:clamp(90px,22%,165px);min-height:100px;
      border-radius:12px;z-index:3;border:1px solid #9be8d8}
    .call-videos--swapped video:nth-of-type(2){position:relative;inset:auto;display:block;
      width:100%;height:100%;min-height:0;max-height:none;border:0;border-radius:0;box-shadow:none;z-index:1}
    .call-recovery-actions{display:flex;justify-content:center;flex-wrap:wrap;gap:8px;margin:5px 0}
    .call-voice-surface.is-active .call-avatar-large{box-shadow:0 0 0 10px #40dfbd22}
    .call-panel{width:min(100%,1020px);height:min(710px,calc(100dvh - 20px))}
    .call-videos{flex:1 1 0;min-height:0;max-height:none}
    .call-videos video:first-child{min-height:0;max-height:none}
    .call-voice-surface{flex:1 1 0;min-height:75px}
    .call-footer{position:relative}
    .call-device-panel{position:absolute;right:0;bottom:calc(100% + 6px);
      width:min(100%,650px);box-sizing:border-box;z-index:10;max-height:48dvh;
      overflow-y:auto;box-shadow:0 16px 45px #0008}
    .call-buttons button{min-width:76px}
    .call-refresh{display:none}
    @media(max-width:600px){
      .call-backdrop{padding:6px}
      .call-panel{max-height:calc(100dvh - 12px);padding:12px;border-radius:15px}
      .call-videos{min-height:0;max-height:none}
      .call-videos video:first-child{max-height:none}
      .call-info{margin:5px 0 0}
      .call-metrics{margin:6px 0}
      .call-device-panel{grid-template-columns:1fr;max-height:34dvh}
      .call-settings-head,.call-device-panel p{grid-column:1}
      .call-device-panel select{grid-row:auto}
      .call-buttons button{padding:8px 10px;font-size:.75rem;min-height:40px}
    }
    @media(max-height:620px){
      .call-videos{max-height:none;min-height:0}
      .call-videos video:first-child{max-height:none;min-height:0}
      .call-avatar{width:38px;height:38px}
      .call-voice-surface{min-height:75px}
    }
  `]
})
export class DirectCallOverlayComponent implements AfterViewChecked, OnDestroy {
  @ViewChild('remoteVideo') private remoteVideo?: ElementRef<HTMLVideoElement>;
  @ViewChild('localVideo') private localVideo?: ElementRef<HTMLVideoElement>;
  @ViewChild('remoteAudio') private remoteAudio?: ElementRef<HTMLAudioElement>;
  private lastRemoteVideo: Track | null = null;
  private lastLocalVideo: Track | null = null;
  private lastRemoteAudio: Track | null = null;
  private readonly mediaSubscription: Subscription;
  settingsOpen=false;
  viewsSwapped=false;
  get speakerSelectionSupported(): boolean {
    return typeof HTMLMediaElement !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype;
  }

  readonly elapsed$: Observable<string>;

  get participantCount(): number {
    return (this.calls.room?.remoteParticipants.size || 0)+1;
  }

  get remoteHasVideo(): boolean {
    const room=this.calls.room;
    return !!room && [...room.remoteParticipants.values()].some(p=>
      [...p.videoTrackPublications.values()].some(pub=>!!pub.track && !pub.isMuted));
  }

  qualityKey(quality: string | null): string {
    switch(quality){
      case 'excellent':return 'calls.qualityExcellent';
      case 'good':return 'calls.qualityGood';
      case 'poor':return 'calls.qualityPoor';
      case 'lost':return 'calls.qualityLost';
      default:return 'calls.qualityUnknown';
    }
  }

  constructor(public readonly calls: DirectCallClientService) {
    this.elapsed$ = combineLatest([this.calls.state$,timer(0,1000)]).pipe(map(([call]) => {
    if (!call?.startedAt) return '00:00';
    const seconds=Math.max(0,Math.floor((Date.now()-call.startedAt)/1000));
    const hours=Math.floor(seconds/3600);
    return hours ? [hours,Math.floor(seconds/60)%60,seconds%60].map(x=>String(x).padStart(2,'0')).join(':')
      : [Math.floor(seconds/60),seconds%60].map(x=>String(x).padStart(2,'0')).join(':');
  }));

    this.mediaSubscription = calls.mediaChanged$.subscribe(() => {
      this.lastRemoteVideo = null;
      this.lastLocalVideo = null;
      this.lastRemoteAudio = null;
    });
    this.mediaSubscription.add(calls.state$.subscribe(call=>{
      if (!call) { this.settingsOpen=false; this.viewsSwapped=false; }
    }));
  }

  toggleSettings(forceOpen=false): void {
    this.settingsOpen=forceOpen || !this.settingsOpen;
    if (this.settingsOpen) void this.calls.refreshDevices();
  }

  selectDevice(kind: MediaDeviceKind, event: Event): void {
    const target=event.target as HTMLSelectElement;
    void this.calls.selectDevice(kind,target.value);
  }

  dismiss(): void {
    const call=this.calls.state$.value;
    if (call?.phase==='incoming') this.calls.decline();
    else if (call?.phase==='error') this.calls.closeError();
    else if (call) this.calls.end();
  }

  ngAfterViewChecked(): void {
    const room=this.calls.room;
    if (!room) return;
    const localVideo=this.localVideo?.nativeElement;
    if (localVideo) {
      for (const publication of room.localParticipant.videoTrackPublications.values()) {
        const track=publication.track;
        if (track && track.kind===Track.Kind.Video && this.lastLocalVideo!==track) {
          track.attach(localVideo);
          this.lastLocalVideo=track;
        }
      }
    }
    for (const participant of room.remoteParticipants.values()) {
      for (const publication of participant.trackPublications.values()) {
        const track=publication.track;
        if (!track) continue;
        if (track.kind===Track.Kind.Video && this.remoteVideo && this.lastRemoteVideo!==track) {
          track.attach(this.remoteVideo.nativeElement);
          this.lastRemoteVideo=track;
        }
        if (track.kind===Track.Kind.Audio && this.remoteAudio && this.lastRemoteAudio!==track) {
          track.attach(this.remoteAudio.nativeElement);
          this.lastRemoteAudio=track;
        }
      }
    }
  }

  ngOnDestroy(): void {
    this.mediaSubscription.unsubscribe();
  }
}
