import { fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
import { DirectCallToneService } from './direct-call-tone.service';

describe('Direct call ringing feedback', () => {
  let original: PropertyDescriptor | undefined;
  let service: DirectCallToneService;
  let played: jasmine.Spy;
  let resumed: jasmine.Spy;
  let audioState: AudioContextState;

  beforeEach(() => {
    original = Object.getOwnPropertyDescriptor(window, 'AudioContext');
    audioState = 'running';
    played = jasmine.createSpy('createOscillator').and.callFake(() => ({
      type: 'sine',
      frequency: { value: 0 },
      onended: null,
      connect: jasmine.createSpy('connect'),
      disconnect: jasmine.createSpy('disconnect'),
      start: jasmine.createSpy('start'),
      stop: jasmine.createSpy('stop')
    }));
    resumed = jasmine.createSpy('resume').and.callFake(async () => {
      audioState = 'running';
    });
    const context = {
      get state() { return audioState; },
      currentTime: 0,
      resume: resumed,
      createOscillator: played,
      createGain: jasmine.createSpy('createGain').and.callFake(() => ({
        gain: {
          setValueAtTime: jasmine.createSpy('setValueAtTime'),
          linearRampToValueAtTime: jasmine.createSpy('linearRampToValueAtTime'),
          exponentialRampToValueAtTime: jasmine.createSpy('exponentialRampToValueAtTime')
        },
        connect: jasmine.createSpy('connect'),
        disconnect: jasmine.createSpy('disconnect')
      })),
      destination: {},
      close: jasmine.createSpy('close').and.resolveTo()
    };
    Object.defineProperty(window, 'AudioContext', {
      configurable: true, value: jasmine.createSpy('AudioContext').and.returnValue(context)
    });
    service = new DirectCallToneService();
  });

  afterEach(() => {
    service.ngOnDestroy();
    if (original) Object.defineProperty(window, 'AudioContext', original);
    else delete (window as Window & { AudioContext?: typeof AudioContext }).AudioContext;
  });

  it('rings during dialing, changes sound for incoming calls and stops on answer', fakeAsync(() => {
    service.prime();
    flushMicrotasks();
    service.sync('dialing');
    expect(played).toHaveBeenCalledTimes(2);
    tick(3300);
    expect(played).toHaveBeenCalledTimes(4);
    service.sync('incoming');
    expect(played).toHaveBeenCalledTimes(6);
    service.sync('active');
    tick(6000);
    expect(played).toHaveBeenCalledTimes(6);
    expect(service.needsGesture$.value).toBeFalse();
  }));

  it('offers a manual browser audio unlock when an incoming call starts suspended', fakeAsync(() => {
    audioState = 'suspended';
    service.sync('incoming');
    expect(service.needsGesture$.value).toBeTrue();
    expect(played).not.toHaveBeenCalled();
    flushMicrotasks();
    expect(resumed).toHaveBeenCalled();
    expect(service.needsGesture$.value).toBeFalse();
    expect(played).toHaveBeenCalledTimes(2);
    service.sync('connecting');
    tick(5000);
    expect(played).toHaveBeenCalledTimes(2);
  }));

  it('never rings after a cancelled or expired call', fakeAsync(() => {
    service.sync('incoming');
    expect(played).toHaveBeenCalledTimes(2);
    service.sync(undefined);
    tick(10000);
    expect(played).toHaveBeenCalledTimes(2);
  }));
});
