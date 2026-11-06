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
    screen.attach.calls.reset();
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
});
