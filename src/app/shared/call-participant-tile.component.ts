import { AfterViewChecked, Component, ElementRef, Input, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LocalParticipant, RemoteParticipant, Track } from 'livekit-client';

/** Each remote participant owns a separate audio element, preventing a third
 * caller from replacing the first caller's microphone playback. */
@Component({
  standalone: true,
  selector: 'app-call-participant-tile',
  imports: [CommonModule],
  template: `
    <article class="connect-tile" [class.speaking]="participant.isSpeaking"
      [class.presenting]="isSharing" [class.with-video]="hasVideo">
      <video #video autoplay playsinline [muted]="local" [hidden]="!hasVideo"
        [attr.aria-label]="label"></video>
      @if (!hasVideo) {
        <div class="connect-avatar" aria-hidden="true">{{ label.slice(0,1).toUpperCase() }}</div>
      }
      <audio #audio autoplay></audio>
      <div class="connect-person">
        <span class="connect-speaker" aria-hidden="true"></span>
        <strong>{{ label }}</strong>
        @if (local) { <span class="connect-self">Tu</span> }
        @if (participant.isMicrophoneEnabled === false) {
          <span class="connect-muted" aria-label="Microfone desligado">⌁</span>
        }
      </div>
    </article>
  `,
  styles: [`
    :host{display:block;min-width:0;min-height:0}
    .connect-tile{position:relative;display:flex;align-items:center;justify-content:center;
      min-height:170px;height:100%;overflow:hidden;border:1px solid #315562;border-radius:17px;
      background:radial-gradient(circle at 50% 40%,#174b51,#0d2634 68%);color:#eafff9}
    .connect-tile.speaking{border-color:#44ecc1;box-shadow:inset 0 0 0 2px #44ecc122}
    .connect-tile video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:#0a2029}
    .connect-tile video[hidden]{display:none}
    .connect-tile video[muted]{transform:scaleX(-1)}
    .connect-avatar{display:grid;place-items:center;width:clamp(70px,10vw,112px);aspect-ratio:1;
      border-radius:50%;border:3px solid #55c8b77a;background:#286b68;font-size:clamp(2rem,4vw,2.7rem);
      font-weight:850;box-shadow:0 0 0 10px #4be8c311}
    .connect-tile.speaking .connect-avatar{border-color:#5bf1cb;box-shadow:0 0 0 9px #4be8c32c}
    .connect-person{position:absolute;left:12px;bottom:12px;display:flex;align-items:center;gap:7px;
      max-width:calc(100% - 24px);padding:7px 12px;border-radius:11px;background:#071e29dc;
      font-size:.8rem;white-space:nowrap}
    .connect-person strong{overflow:hidden;text-overflow:ellipsis;min-width:0}
    .connect-speaker{flex:0 0 7px;width:7px;height:7px;border-radius:50%;background:#688f97}
    .speaking .connect-speaker{background:#50edbb;box-shadow:0 0 0 4px #40dba72c}
    .connect-self{color:#9de9d6;font-size:.66rem}.connect-muted{color:#ffbbc2}
    @media(prefers-reduced-motion:reduce){.connect-tile{transition:none}}
  `]
})
export class CallParticipantTileComponent implements AfterViewChecked, OnDestroy {
  @Input({required:true}) participant!: LocalParticipant | RemoteParticipant;
  @Input() label = '';
  @Input() local = false;
  @ViewChild('video') private videoElement?: ElementRef<HTMLVideoElement>;
  @ViewChild('audio') private audioElement?: ElementRef<HTMLAudioElement>;
  private lastVideo: {attach(e: HTMLMediaElement): void; detach(e: HTMLMediaElement): void} | null = null;
  private lastAudio: {attach(e: HTMLMediaElement): void; detach(e: HTMLMediaElement): void} | null = null;

  private get activeVideo() {
    const publications=[...this.participant.videoTrackPublications.values()];
    return (publications.find(p=>p.source===Track.Source.ScreenShare && !!p.track && !p.isMuted)
      || publications.find(p=>!!p.track && !p.isMuted))?.track || null;
  }
  get hasVideo(): boolean { return !!this.activeVideo; }
  get isSharing(): boolean {
    return [...this.participant.videoTrackPublications.values()]
      .some(p=>p.source===Track.Source.ScreenShare && !!p.track && !p.isMuted);
  }

  ngAfterViewChecked(): void {
    const video=this.videoElement?.nativeElement;
    const nextVideo=this.activeVideo;
    if (video && this.lastVideo!==nextVideo) {
      this.lastVideo?.detach(video);
      this.lastVideo=nextVideo;
      nextVideo?.attach(video);
    }
    const audio=this.audioElement?.nativeElement;
    const nextAudio=this.local ? null :
      ([...this.participant.audioTrackPublications.values()]
        .find(p=>!!p.track && !p.isMuted)?.track || null);
    if (audio && this.lastAudio!==nextAudio) {
      this.lastAudio?.detach(audio);
      this.lastAudio=nextAudio;
      nextAudio?.attach(audio);
    }
  }

  ngOnDestroy(): void {
    if (this.videoElement) this.lastVideo?.detach(this.videoElement.nativeElement);
    if (this.audioElement) this.lastAudio?.detach(this.audioElement.nativeElement);
  }
}
