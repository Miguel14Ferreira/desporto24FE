import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

type RingTone = 'incoming' | 'dialing';

/**
 * Short, original two-note call signals. No remote assets, recordings or
 * third-party ringtone files. Browsers may require a real click/tap before
 * Web Audio becomes audible; in that case the call UI offers an unlock button.
 */
@Injectable({providedIn: 'root'})
export class DirectCallToneService implements OnDestroy {
  readonly needsGesture$ = new BehaviorSubject<boolean>(false);
  private context: AudioContext | null = null;
  private mode: RingTone | null = null;
  private interval?: ReturnType<typeof setInterval>;
  private oscillators = new Set<OscillatorNode>();

  /** Invoke synchronously inside the user's outgoing call click. */
  prime(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (ctx.state === 'running') {
      this.needsGesture$.next(false);
      if (this.mode) this.playCycle();
      return;
    }
    this.needsGesture$.next(true);
    try {
      void ctx.resume().then(() => {
        if (this.context !== ctx) return;
        this.needsGesture$.next(ctx.state !== 'running');
        if (this.mode && ctx.state === 'running') this.playCycle();
      }).catch(() => {
        if (this.context === ctx) this.needsGesture$.next(true);
      });
    } catch {
      this.needsGesture$.next(true);
    }
  }

  /** The server-acknowledged call state is authoritative for tones. */
  sync(phase: string | undefined): void {
    const next: RingTone | null = phase === 'incoming' ? 'incoming'
      : phase === 'dialing' ? 'dialing' : null;
    if (!next) {
      this.stop();
      return;
    }
    if (this.mode === next) return;
    this.stopCycle();
    this.mode = next;
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (ctx.state === 'running') {
      this.needsGesture$.next(false);
      this.playCycle();
    } else {
      // An incoming websocket invitation may not have user activation.
      // Try autoplay, but show an explicit tap-to-enable control if blocked.
      this.prime();
    }
  }

  stop(): void {
    this.mode = null;
    this.stopCycle();
    this.needsGesture$.next(false);
  }

  private ensureContext(): AudioContext | null {
    if (this.context) return this.context;
    try {
      const w = window as Window & {webkitAudioContext?: typeof AudioContext};
      const Audio = w.AudioContext || w.webkitAudioContext;
      if (!Audio) return null;
      this.context = new Audio();
      return this.context;
    } catch {
      return null;
    }
  }

  private playCycle(): void {
    this.stopCycle();
    const ctx = this.context;
    if (!ctx || ctx.state !== 'running' || !this.mode) return;
    const mode = this.mode;
    const cadence = mode === 'incoming' ? 2600 : 3300;
    const play = () => {
      if (this.context !== ctx || this.mode !== mode || ctx.state !== 'running') return;
      const base = ctx.currentTime + 0.02;
      const notes = mode === 'incoming'
        ? [[640, 0, 0.27], [780, 0.39, 0.29]]
        : [[425, 0, 0.26], [480, 0.39, 0.26]];
      for (const [frequency, delay, duration] of notes) {
        try {
          const oscillator = ctx.createOscillator();
          const gain = ctx.createGain();
          const start = base + delay;
          oscillator.type = 'sine';
          oscillator.frequency.value = frequency;
          gain.gain.setValueAtTime(0.001, start);
          gain.gain.linearRampToValueAtTime(0.06, start + 0.025);
          gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
          oscillator.connect(gain);
          gain.connect(ctx.destination);
          oscillator.onended = () => {
            oscillator.disconnect();
            gain.disconnect();
            this.oscillators.delete(oscillator);
          };
          this.oscillators.add(oscillator);
          oscillator.start(start);
          oscillator.stop(start + duration + 0.01);
        } catch {
          // Audio devices or the page may become unavailable mid-call.
        }
      }
    };
    play();
    this.interval = setInterval(play, cadence);
  }

  private stopCycle(): void {
    if (this.interval) clearInterval(this.interval);
    this.interval = undefined;
    for (const oscillator of this.oscillators) {
      try { oscillator.stop(); } catch { /* Already stopped. */ }
      try { oscillator.disconnect(); } catch { /* Already disconnected. */ }
    }
    this.oscillators.clear();
  }

  ngOnDestroy(): void {
    this.stop();
    const ctx = this.context;
    this.context = null;
    if (ctx) void ctx.close().catch(() => {});
    this.needsGesture$.complete();
  }
}
