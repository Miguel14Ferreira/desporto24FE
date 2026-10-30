import { of, throwError } from 'rxjs';
import { CommunitiesComponent } from './communities.component';

describe('Editing an existing community cover', () => {
  let component: CommunitiesComponent;
  let framing: jasmine.Spy;
  let upload: jasmine.Spy;

  beforeEach(() => {
    component = Object.create(CommunitiesComponent.prototype) as CommunitiesComponent;
    component.selected = {
      id: 42, name: 'ACM', photoUrl: 'https://cdn.example/communities/42/animated.gif',
      myRole: 'OWNER', photoZoom: 1.2, photoFocusX: 38, photoFocusY: 60
    } as any;
    component.photoUpdating = false;
    component.avatarCropUrl = '';
    component.avatarCropFile = null;
    component.avatarCropExisting = false;
    component.avatarCropReady = false;
    component.avatarCropAnimated = false;
    component.avatarCropZoom = 1;
    component.avatarCropFocusX = 50;
    component.avatarCropFocusY = 50;
    component.avatarCropOffsetX = 0;
    component.avatarCropOffsetY = 0;
    component.avatarCropMetrics = null;
    component.avatarCropError = '';
    framing = jasmine.createSpy('updatePhotoFraming').and.callFake(() => of({
      ...component.selected, photoZoom: 1.8, photoFocusX: 40, photoFocusY: 70
    }));
    upload = jasmine.createSpy('updatePhoto');
    (component as any).communityService = { updatePhotoFraming: framing, updatePhoto: upload };
    spyOn(component, 'canManage').and.returnValue(true);
    spyOn<any>(component, 'replaceCommunity').and.stub();
  });

  it('opens current GIF without any file picker or upload, with stored framing', () => {
    component.openExistingCommunityAvatarCrop();
    expect(component.avatarCropExisting).toBeTrue();
    expect(component.avatarCropFile).toBeNull();
    expect(component.avatarCropReady).toBeTrue();
    expect(component.avatarCropZoom).toBe(1.2);
    expect(component.avatarCropFocusX).toBe(38);
    expect(component.avatarCropFocusY).toBe(60);
    expect(upload).not.toHaveBeenCalled();
  });

  it('updates metadata only, never re-encodes or replaces the original GIF', async () => {
    component.openExistingCommunityAvatarCrop();
    component.avatarCropZoom = 1.8;
    component.avatarCropFocusX = 40;
    component.avatarCropFocusY = 70;
    await component.saveCommunityAvatarCrop();
    expect(framing).toHaveBeenCalledOnceWith(42,
      'https://cdn.example/communities/42/animated.gif', 1.8, 40, 70, 'COVER');
    expect(upload).not.toHaveBeenCalled();
    expect(component.selected?.photoUrl).toContain('animated.gif');
    expect(component.avatarCropExisting).toBeFalse();
  });

  it('shows the complete GIF with a blurred background and permits zoom below 1', async () => {
    component.openExistingCommunityAvatarCrop();
    component.setCommunityAvatarFitMode('SHOW_ALL');
    expect(component.avatarCropFitMode).toBe('SHOW_ALL');
    expect(component.avatarCropZoom).toBe(1);
    expect(component.communityCoverFit({ photoFitMode: 'SHOW_ALL' })).toBe('contain');
    component.onCommunityAvatarZoom({ target: { value: '0.6' } } as any);
    expect(component.avatarCropZoom).toBe(0.6);
    await component.saveCommunityAvatarCrop();
    expect(framing).toHaveBeenCalledOnceWith(42,
      'https://cdn.example/communities/42/animated.gif', 0.6, 50, 50, 'SHOW_ALL');
    expect(upload).not.toHaveBeenCalled();
  });

  it('returns to cover mode with zoom >= 1', () => {
    component.openExistingCommunityAvatarCrop();
    component.setCommunityAvatarFitMode('SHOW_ALL');
    component.setCommunityAvatarFitMode('COVER');
    component.onCommunityAvatarZoom({ target: {value: '0.6'} } as any);
    expect(component.avatarCropZoom).toBe(1);
    expect(component.communityCoverFit({ photoFitMode: 'COVER' })).toBe('cover');
  });

  it('cancels without saving', () => {
    component.openExistingCommunityAvatarCrop();
    component.avatarCropZoom = 3;
    component.cancelCommunityAvatarCrop();
    expect(component.avatarCropExisting).toBeFalse();
    expect(framing).not.toHaveBeenCalled();
    expect(upload).not.toHaveBeenCalled();
  });

  it('supports dragging focus and clamps it to safe percentages', () => {
    component.openExistingCommunityAvatarCrop();
    const stage = {
      setPointerCapture: jasmine.createSpy('setPointerCapture'),
      getBoundingClientRect: () => ({ width: 400, height: 250 })
    } as any;
    component.onCommunityAvatarPointerDown({
      currentTarget: stage, pointerId: 1, clientX: 100, clientY: 100,
      preventDefault: () => {}
    } as any);
    component.onCommunityAvatarPointerMove({
      currentTarget: stage, pointerId: 1, clientX: 500, clientY: -200
    } as any);
    expect(component.avatarCropFocusX).toBe(0);
    expect(component.avatarCropFocusY).toBe(100);
  });

  it('does not save when the current image has changed before confirmation', async () => {
    component.openExistingCommunityAvatarCrop();
    component.selected = { id: 42, name: 'ACM',
      photoUrl: 'https://cdn.example/new.jpg', myRole: 'OWNER' } as any;
    await component.saveCommunityAvatarCrop();
    expect(framing).not.toHaveBeenCalled();
  });

  it('offers retry if the API rejects a stale framing update', async () => {
    framing.and.returnValue(throwError(() => ({status:409})));
    component.openExistingCommunityAvatarCrop();
    await component.saveCommunityAvatarCrop();
    expect(component.avatarCropExisting).toBeTrue();
    expect(component.avatarCropError).toBeTruthy();
    expect(component.photoUpdating).toBeFalse();
  });

  it('applies default cover styling without modifying an unframed GIF', () => {
    const plain = { photoZoom: null, photoFocusX: null, photoFocusY: null };
    expect(component.communityCoverZoom(plain)).toBeNull();
    expect(component.communityCoverPosition(plain)).toBe('50% 50%');
    expect(component.communityCoverZoom({photoZoom: 1.5})).toBe('scale(1.5)');
  });
});
