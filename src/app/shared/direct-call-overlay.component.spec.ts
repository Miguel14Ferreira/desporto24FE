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
      members$: new BehaviorSubject({participants:[],pending:[]}),
      invitationBusy$: new BehaviorSubject(false),
      invitationError$: new BehaviorSubject(null),
      inviteMember: jasmine.createSpy('inviteMember').and.returnValue(Promise.resolve(true)),
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


  it('shows a clean connecting state without premature clock or connection quality', () => {
    state.next({...invitation('voice'), phase:'dialing'});
    fixture.detectChanges();
    const body = fixture.nativeElement as HTMLElement;
    expect(body.querySelector('.connect-waiting')).toBeTruthy();
    expect(body.querySelector('.call-metric')).toBeNull();
    expect(body.textContent).toContain('À espera de resposta');
    expect(body.querySelector('.call-brand')?.textContent).toContain('Connect');
  });

  it('supports minimized mode without terminating the live call', () => {
    state.next({...invitation('voice'),phase:'active',startedAt:Date.now()});
    fixture.detectChanges();
    const minimize=fixture.nativeElement.querySelector('.connect-minimize') as HTMLButtonElement;
    expect(minimize).toBeTruthy();
    minimize.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.call-backdrop')).toBeNull();
    expect(fixture.nativeElement.querySelector('.connect-mini')).toBeTruthy();
    expect(calls.end).not.toHaveBeenCalled();
    (fixture.nativeElement.querySelector('.connect-mini button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.call-backdrop')).toBeTruthy();
    state.next(null);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.connect-mini')).toBeNull();
  });

  it('invites a username only through the authenticated calling service', async () => {
    state.next({...invitation('voice'),phase:'active',startedAt:Date.now()});
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.connect-invite-button') as HTMLButtonElement).click();
    fixture.detectChanges();
    const input=fixture.nativeElement.querySelector('#connect-invite-name') as HTMLInputElement;
    expect(input).toBeTruthy();
    input.value='carlos';
    input.dispatchEvent(new Event('input',{bubbles:true}));
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.connect-invite-form button') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(calls.inviteMember).toHaveBeenCalledOnceWith('carlos');
    expect(fixture.componentInstance.inviteUsername).toBe('');
    expect(calls.end).not.toHaveBeenCalled();
  });

  it('exposes a camera toggle even if the call began as voice only', () => {
    state.next({...invitation('voice'),phase:'active',startedAt:Date.now()});
    fixture.detectChanges();
    const controls = fixture.nativeElement.querySelectorAll('.call-buttons button') as NodeListOf<HTMLButtonElement>;
    expect(Array.from(controls).some(button=>button.textContent?.includes('Ativar câmara'))).toBeTrue();
    expect(Array.from(controls).some(button=>button.textContent?.includes('Convidar pessoas'))).toBeTrue();
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
