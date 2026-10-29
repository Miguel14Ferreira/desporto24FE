import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { DirectCallClientService, DirectCallState } from '../services/direct-call-client.service';
import { DirectCallOverlayComponent } from './direct-call-overlay.component';

describe('Global incoming call popup', () => {
  let fixture: ComponentFixture<DirectCallOverlayComponent>;
  let state: BehaviorSubject<DirectCallState | null>;
  let ringtoneBlocked: BehaviorSubject<boolean>;
  let calls: any;

  const invitation = (media: 'voice' | 'video' = 'video'): DirectCallState => ({
    id: 'call-one',
    peer: 'beatriz',
    media,
    phase: 'incoming',
    micEnabled: false,
    cameraEnabled: false,
    expiresAt: Date.now() + 60_000
  });

  beforeEach(async () => {
    localStorage.removeItem('d24-language');
    state = new BehaviorSubject<DirectCallState | null>(null);
    ringtoneBlocked = new BehaviorSubject(false);
    calls = {
      state$: state,
      mediaChanged$: new BehaviorSubject(0),
      connectionQuality$: new BehaviorSubject('unknown'),
      devices$: new BehaviorSubject([]),
      selectedDevices$: new BehaviorSubject({}),
      audioPlaybackBlocked$: new BehaviorSubject(false),
      ringtoneBlocked$: ringtoneBlocked,
      busyMedia$: new BehaviorSubject(false),
      screenShareEnabled$: new BehaviorSubject(false),
      canShareScreen: false,
      room: null,
      accept: jasmine.createSpy('accept'),
      decline: jasmine.createSpy('decline'),
      closeError: jasmine.createSpy('closeError'),
      end: jasmine.createSpy('end'),
      allowRingtone: jasmine.createSpy('allowRingtone'),
      allowAudio: jasmine.createSpy('allowAudio'),
      refreshDevices: jasmine.createSpy('refreshDevices')
    };
    await TestBed.configureTestingModule({
      imports: [DirectCallOverlayComponent],
      providers: [{provide: DirectCallClientService, useValue: calls}]
    }).compileComponents();
    fixture = TestBed.createComponent(DirectCallOverlayComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    fixture.destroy();
    localStorage.removeItem('d24-language');
  });

  it('does not cover or block any page while there is no call', () => {
    const host: HTMLElement = fixture.nativeElement;
    expect(host.querySelector('.call-incoming-float')).toBeNull();
    expect(host.querySelector('.call-backdrop')).toBeNull();
  });

  it('shows an accessible, non-modal floating card with the caller and media type', () => {
    state.next(invitation());
    fixture.detectChanges();
    const popup: HTMLElement = fixture.nativeElement.querySelector('.call-incoming-float');
    expect(popup).not.toBeNull();
    expect(popup.getAttribute('role')).toBe('alertdialog');
    expect(popup.getAttribute('aria-modal')).toBe('false');
    expect(popup.textContent).toContain('beatriz');
    expect(popup.textContent).toContain('Videochamada');
    expect(popup.querySelectorAll('.call-incoming-actions button').length).toBe(2);
    expect(fixture.nativeElement.querySelector('.call-backdrop')).toBeNull();
  });

  it('accepts from the compact card and transitions to the existing full call view', () => {
    state.next(invitation('voice'));
    calls.accept.and.callFake(() => {
      state.next({...invitation('voice'), phase: 'connecting'});
      return Promise.resolve();
    });
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.call-incoming-accept') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(calls.accept).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.querySelector('.call-incoming-float')).toBeNull();
    const dialog: HTMLElement = fixture.nativeElement.querySelector('.call-backdrop');
    expect(dialog).not.toBeNull();
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.textContent).toContain('beatriz');
  });

  it('rejects a call without showing the full screen or navigating', () => {
    state.next(invitation());
    calls.decline.and.callFake(() => state.next(null));
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.call-incoming-decline') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(calls.decline).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.querySelector('.call-backdrop')).toBeNull();
    expect(fixture.nativeElement.querySelector('.call-incoming-float')).toBeNull();
  });

  it('offers the sound unlock only when browser autoplay was blocked', () => {
    state.next(invitation());
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.call-incoming-audio')).toBeNull();
    ringtoneBlocked.next(true);
    fixture.detectChanges();
    const unlock: HTMLButtonElement = fixture.nativeElement.querySelector('.call-incoming-audio button');
    expect(unlock).not.toBeNull();
    unlock.click();
    expect(calls.allowRingtone).toHaveBeenCalledTimes(1);
  });

  it('uses the same compact incoming UI for voice calls and Escape to reject', () => {
    state.next(invitation('voice'));
    fixture.detectChanges();
    const popup: HTMLElement = fixture.nativeElement.querySelector('.call-incoming-float');
    expect(popup.textContent).toContain('Chamada de voz');
    popup.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
    expect(calls.decline).toHaveBeenCalledTimes(1);
  });

  it('removes the compact popup when a call expires or is answered on another device', () => {
    state.next(invitation());
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.call-incoming-float')).not.toBeNull();
    state.next(null);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.call-incoming-float')).toBeNull();
  });
});
