import { LocalParticipant, Track } from 'livekit-client';
import { CallParticipantTileComponent } from './call-participant-tile.component';

describe('Call participant tile track selection', () => {
  const track = () => ({
    attach: jasmine.createSpy('attach'),
    detach: jasmine.createSpy('detach')
  });
  const camera = track();
  const screen = track();
  const participant = {
    videoTrackPublications: new Map([
      ['screen', {source: Track.Source.ScreenShare, track: screen, isMuted: false}],
      ['camera', {source: Track.Source.Camera, track: camera, isMuted: false}]
    ]),
    audioTrackPublications: new Map(),
    isSpeaking: false,
    isMicrophoneEnabled: true
  } as unknown as LocalParticipant;

  beforeEach(() => {
    camera.attach.calls.reset();
    camera.detach.calls.reset();
    screen.attach.calls.reset();
    screen.detach.calls.reset();
  });

  it('keeps a local camera preview when the user also shares a screen', () => {
    const component = new CallParticipantTileComponent();
    component.participant = participant;
    component.local = true;
    const video = document.createElement('video');
    (component as any).videoElement = {nativeElement: video};
    expect(component.hasVideo).toBeTrue();
    component.ngAfterViewChecked();
    expect(camera.attach).toHaveBeenCalledWith(video);
    expect(screen.attach).not.toHaveBeenCalled();
    component.ngOnDestroy();
  });

  it('attaches the complete screen track to the independent presentation tile', () => {
    const component = new CallParticipantTileComponent();
    component.participant = participant;
    component.local = true;
    component.presentation = true;
    const video = document.createElement('video');
    (component as any).videoElement = {nativeElement: video};
    expect(component.isSharing).toBeTrue();
    component.ngAfterViewChecked();
    expect(screen.attach).toHaveBeenCalledWith(video);
    expect(camera.attach).not.toHaveBeenCalled();
    component.ngOnDestroy();
  });
  it('reattaches the camera after Angular replaces its video element', () => {
    const component = new CallParticipantTileComponent();
    component.participant = participant;
    component.local = true;
    const first = document.createElement('video');
    const second = document.createElement('video');
    (component as any).videoElement = {nativeElement: first};
    component.ngAfterViewChecked();
    (component as any).videoElement = {nativeElement: second};
    component.ngAfterViewChecked();
    expect(camera.detach).toHaveBeenCalledOnceWith(first);
    expect(camera.attach).toHaveBeenCalledTimes(2);
    expect(camera.attach).toHaveBeenCalledWith(second);
    component.ngOnDestroy();
    expect(camera.detach).toHaveBeenCalledWith(second);
    expect(screen.attach).not.toHaveBeenCalled();
  });

  it('reattaches the remote microphone to a replacement audio element without duplication', () => {
    const microphone = track();
    const remote = {
      ...participant,
      audioTrackPublications: new Map([
        ['microphone', {track: microphone, isMuted: false}]
      ])
    } as unknown as LocalParticipant;
    const component = new CallParticipantTileComponent();
    component.participant = remote;
    const first = document.createElement('audio');
    const second = document.createElement('audio');
    (component as any).audioElement = {nativeElement: first};
    component.ngAfterViewChecked();
    (component as any).audioElement = {nativeElement: second};
    component.ngAfterViewChecked();
    expect(microphone.detach).toHaveBeenCalledOnceWith(first);
    expect(microphone.attach).toHaveBeenCalledTimes(2);
    expect(microphone.attach).toHaveBeenCalledWith(second);
    component.ngAfterViewChecked();
    expect(microphone.attach).toHaveBeenCalledTimes(2);
    component.ngOnDestroy();
    expect(microphone.detach).toHaveBeenCalledWith(second);
  });

  it('detaches the previous camera before attaching a replacement camera track', () => {
    const oldCamera = track();
    const newCamera = track();
    const device = {
      ...participant,
      videoTrackPublications: new Map([
        ['camera', {source: Track.Source.Camera, track: oldCamera, isMuted: false}]
      ])
    } as unknown as LocalParticipant;
    const component = new CallParticipantTileComponent();
    component.participant = device;
    component.local = true;
    const element = document.createElement('video');
    (component as any).videoElement = {nativeElement: element};
    component.ngAfterViewChecked();
    (device.videoTrackPublications.get('camera') as any).track = newCamera;
    component.ngAfterViewChecked();
    expect(oldCamera.detach).toHaveBeenCalledOnceWith(element);
    expect(newCamera.attach).toHaveBeenCalledOnceWith(element);
    component.ngOnDestroy();
  });

  it('never plays the same remote microphone twice while sharing a screen', () => {
    const audioTrack = {
      attach: jasmine.createSpy('audioAttach'),
      detach: jasmine.createSpy('audioDetach')
    };
    const remote = {
      ...participant,
      audioTrackPublications: new Map([
        ['microphone', {track: audioTrack, isMuted: false}]
      ])
    } as unknown as LocalParticipant;
    const screenTile = new CallParticipantTileComponent();
    screenTile.participant = remote;
    screenTile.presentation = true;
    screenTile.local = false;
    (screenTile as any).audioElement = {nativeElement: document.createElement('audio')};
    screenTile.ngAfterViewChecked();
    expect(audioTrack.attach).not.toHaveBeenCalled();
    screenTile.ngOnDestroy();

    const cameraTile = new CallParticipantTileComponent();
    cameraTile.participant = remote;
    cameraTile.presentation = false;
    cameraTile.local = false;
    (cameraTile as any).audioElement = {nativeElement: document.createElement('audio')};
    cameraTile.ngAfterViewChecked();
    expect(audioTrack.attach).toHaveBeenCalledTimes(1);
    cameraTile.ngOnDestroy();
  });

});
