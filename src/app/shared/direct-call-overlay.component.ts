import { AfterViewChecked, Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Track } from 'livekit-client';
import { Subscription } from 'rxjs';
import { TranslatePipe } from '../i18n/translate.pipe';
import { DirectCallClientService } from '../services/direct-call-client.service';

/** A single, route-independent calling surface. No changes to the desktop chat layout. */
@Component({
  selector: 'app-direct-call-overlay',
  standalone: true,
  imports: [CommonModule, TranslatePipe],
  template: `
    @if (calls.state$ | async; as call) {
      <section class="call-backdrop" role="dialog" aria-modal="true"
          [attr.aria-label]="'calls.title' | t" (keydown.escape)="dismiss()">
        <div class="call-panel" tabindex="-1">
          <div class="call-topline"><strong>Jynlo</strong><span>{{ 'calls.title' | t }}</span></div>
          <div class="call-info">
            <span class="call-avatar" aria-hidden="true">{{ call.peer.slice(0,1).toUpperCase() }}</span>
            <h2>{{ call.peer }}</h2>
            <p class="call-media-type">{{ (call.media === 'video' ? 'calls.video' : 'calls.voice') | t }}</p>
            @if (call.phase !== 'error') {
              <p role="status">{{ (call.phase === 'incoming' ? 'calls.incoming' :
                call.phase === 'dialing' ? 'calls.ringing' :
                call.phase === 'connecting' ? 'calls.connecting' : 'calls.connected') | t }}</p>
            }
          </div>
          @if (call.media === 'video' && call.phase !== 'incoming' && call.phase !== 'error') {
            <div class="call-videos">
              <video #remoteVideo autoplay playsinline [attr.aria-label]="'calls.remoteVideo' | t"></video>
              <video #localVideo autoplay playsinline muted [attr.aria-label]="'calls.localVideo' | t"></video>
            </div>
          }
          @if (call.phase !== 'error') { <audio #remoteAudio autoplay></audio> }
          @if (call.error) { <p class="call-error" role="alert">{{ call.error | t }}</p> }
          <div class="call-buttons">
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
                [attr.aria-pressed]="!call.micEnabled">{{ (call.micEnabled ? 'calls.mute' : 'calls.unmute') | t }}</button>
              @if (call.media === 'video') {
                <button type="button" (click)="calls.setCamera(!call.cameraEnabled)"
                  [attr.aria-pressed]="!call.cameraEnabled">{{ (call.cameraEnabled ? 'calls.cameraOff' : 'calls.cameraOn') | t }}</button>
              }
              <button type="button" (click)="calls.allowAudio()">{{ 'calls.sound' | t }}</button>
              <button type="button" class="call-decline" (click)="calls.end()">{{ 'calls.hangUp' | t }}</button>
            }
          </div>
          <span class="call-refresh" aria-hidden="true">{{ calls.mediaChanged$ | async }}</span>
        </div>
      </section>
    }
  `,
  styles: [`
    :host { display:contents; }
    .call-backdrop { position:fixed; inset:0; z-index:6000; display:grid; place-items:center;
      padding:20px; background:rgba(0,14,23,.88); backdrop-filter:blur(7px); }
    .call-panel { width:min(100%,460px); max-height:95dvh; overflow-y:auto; padding:24px;
      color:#e6f9f4; background:linear-gradient(140deg,#0b2633,#153e48);
      border:1px solid #477a79; border-radius:24px;
      box-shadow:0 20px 80px rgba(0,0,0,.45); }
    .call-topline {display:flex;justify-content:space-between;align-items:center;
      color:#72e2cb;font-size:.84rem;letter-spacing:.04em;}
    .call-info {text-align:center;margin:20px 0;}
    .call-avatar {display:grid;place-items:center;width:76px;height:76px;margin:0 auto 14px;
      border-radius:50%;background:#27615d;color:#bdf9eb;font-size:2rem;font-weight:700;}
    .call-info h2 {font-size:1.35rem;margin:0 0 8px;overflow-wrap:anywhere;}
    .call-info p {color:#accfd0;font-size:.86rem;margin:0;}
    .call-media-type {color:#7ce2c6!important;font-weight:700;margin:0 0 5px!important;}
    .call-videos {position:relative;min-height:210px;max-height:360px;
      overflow:hidden;background:#081c28;border-radius:17px;margin-bottom:20px;}
    .call-videos video:first-child {display:block;width:100%;height:300px;object-fit:cover;}
    .call-videos video:nth-child(2) {position:absolute;right:12px;bottom:12px;
      width:100px;height:130px;object-fit:cover;border-radius:10px;border:1px solid #95ddc9;
      background:#1d4955;transform:scaleX(-1);}
    .call-buttons {display:flex;justify-content:center;flex-wrap:wrap;gap:10px;}
    .call-buttons button {border:1px solid #527f7b;background:#20544e;color:#e8fff8;
      padding:10px 13px;min-height:42px;border-radius:12px;cursor:pointer;font:inherit;font-size:.86rem;}
    .call-buttons button:hover {background:#2b6860;}
    .call-buttons button:focus-visible {outline:2px solid #7cf2d2;outline-offset:2px;}
    .call-buttons .call-accept {background:#147b60;border-color:#2dddab;}
    .call-buttons .call-decline {background:#7c3a42;border-color:#d87979;}
    .call-error {text-align:center;color:#ffc7c4;font-size:.84rem;}
    .call-refresh {display:none;}
    @media(max-width:480px) {.call-backdrop{padding:8px;}.call-panel{padding:20px 12px;}.call-videos video:first-child{height:250px;}}
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

  constructor(public readonly calls: DirectCallClientService) {
    this.mediaSubscription = calls.mediaChanged$.subscribe(() => {
      this.lastRemoteVideo = null;
      this.lastLocalVideo = null;
      this.lastRemoteAudio = null;
    });
  }

  dismiss(): void {
    const call = this.calls.state$.value;
    if (call?.phase === 'incoming') this.calls.decline();
    else if (call?.phase === 'error') this.calls.closeError();
    else if (call) this.calls.end();
  }

  ngAfterViewChecked(): void {
    const room = this.calls.room;
    if (!room) return;
    const localVideo = this.localVideo?.nativeElement;
    if (localVideo) {
      for (const publication of room.localParticipant.videoTrackPublications.values()) {
        const track = publication.track;
        if (track && track.kind === Track.Kind.Video && this.lastLocalVideo !== track) {
          track.attach(localVideo);
          this.lastLocalVideo = track;
        }
      }
    }
    for (const participant of room.remoteParticipants.values()) {
      for (const publication of participant.trackPublications.values()) {
        const track = publication.track;
        if (!track) continue;
        if (track.kind === Track.Kind.Video && this.remoteVideo
            && this.lastRemoteVideo !== track) {
          track.attach(this.remoteVideo.nativeElement);
          this.lastRemoteVideo = track;
        }
        if (track.kind === Track.Kind.Audio && this.remoteAudio
            && this.lastRemoteAudio !== track) {
          track.attach(this.remoteAudio.nativeElement);
          this.lastRemoteAudio = track;
        }
      }
    }
  }

  ngOnDestroy(): void {
    this.mediaSubscription.unsubscribe();
  }
}
