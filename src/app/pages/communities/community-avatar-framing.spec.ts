import { of, throwError } from 'rxjs';
import { CommunitiesComponent } from './communities.component';

describe('Community cover editor', () => {
  let component: CommunitiesComponent;
  let updatePhoto: jasmine.Spy;

  beforeEach(() => {
    component = Object.create(CommunitiesComponent.prototype) as CommunitiesComponent;
    component.selected = { id: 42, name: 'ACM', myRole: 'OWNER', photoUrl: null } as any;
    component.photoUpdating = false;
    component.avatarCropFile = null;
    component.avatarCropUrl = '';
    component.avatarCropAnimated = false;
    component.avatarCropReady = false;
    component.avatarCropZoom = 1;
    component.avatarCropOffsetX = 0;
    component.avatarCropOffsetY = 0;
    component.avatarCropMetrics = null;
    component.avatarCropError = '';
    updatePhoto = jasmine.createSpy('updatePhoto').and.callFake(() => of({
      id: 42, name: 'ACM', photoUrl: '/media/communities/42/cover.gif', myRole: 'OWNER'
    }));
    (component as any).communityService = { updatePhoto };
    spyOn(component, 'canManage').and.returnValue(true);
    spyOn<any>(component, 'replaceCommunity').and.stub();
  });

  afterEach(() => {
    component.cancelCommunityAvatarCrop();
  });

  it('previews a GIF without uploading and preserves its animation bytes on save', async () => {
    const gif = new File(['GIF89a', 'more-frames'], 'animated.gif', { type: 'image/gif' });
    const input = { files: [gif], value: 'animated.gif' } as unknown as HTMLInputElement;
    component.onCommunityPhotoChange({ target: input } as unknown as Event);
    expect(input.value).toBe('');
    expect(component.avatarCropFile).toBe(gif);
    expect(component.avatarCropReady).toBeTrue();
    expect(component.avatarCropAnimated).toBeTrue();
    expect(updatePhoto).not.toHaveBeenCalled();

    await component.saveCommunityAvatarCrop();
    expect(updatePhoto).toHaveBeenCalledOnceWith(42, gif, 'COVER', 1, 50, 50);
    expect(component.selected?.photoUrl).toBe('/media/communities/42/cover.gif');
    expect(component.avatarCropFile).toBeNull();
  });

  it('can upload an unchanged animated GIF in SHOW_ALL mode', async () => {
    const gif = new File(['GIF89a', 'more-frames'], 'animated.gif', {type:'image/gif'});
    component.onCommunityPhotoChange({target:{files:[gif], value:'animated.gif'}} as any);
    component.setCommunityAvatarFitMode('SHOW_ALL');
    component.onCommunityAvatarZoom({target:{value:'0.65'}} as any);
    await component.saveCommunityAvatarCrop();
    expect(updatePhoto).toHaveBeenCalledOnceWith(42, gif, 'SHOW_ALL', 0.65, 50, 50);
  });

  it('lets the user cancel a preview with no upload, including reselecting the same file', () => {
    const gif = new File(['GIF89a'], 'animated.gif', { type: 'image/gif' });
    const input = { files: [gif], value: 'animated.gif' } as unknown as HTMLInputElement;
    component.onCommunityPhotoChange({ target: input } as unknown as Event);
    component.cancelCommunityAvatarCrop();
    expect(component.avatarCropFile).toBeNull();
    expect(component.avatarCropUrl).toBe('');
    expect(updatePhoto).not.toHaveBeenCalled();
    component.onCommunityPhotoChange({ target: input } as unknown as Event);
    expect(component.avatarCropFile).toBe(gif);
  });

  it('rejects a video before creating any preview or issuing an upload', () => {
    const video = new File(['video'], 'video.mp4', { type: 'video/mp4' });
    component.onCommunityPhotoChange({ target: {files:[video],value:'video.mp4'} } as any);
    expect(component.avatarCropFile).toBeNull();
    expect(updatePhoto).not.toHaveBeenCalled();
    expect(component.errorMessage).toBeTruthy();
  });

  it('supports accessible keyboard repositioning within bounded crop limits', () => {
    component.avatarCropMetrics = {
      scaledWidth: 1200, scaledHeight: 720, widthPercent: 125, heightPercent: 120,
      maxOffsetX: 12.5, maxOffsetY: 10
    };
    const event = new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true });
    component.onCommunityAvatarCropKey(event);
    expect(component.avatarCropOffsetX).toBe(2);
    expect(event.defaultPrevented).toBeTrue();
    for (let index = 0; index < 20; index++) {
      component.onCommunityAvatarCropKey(new KeyboardEvent('keydown', {key:'ArrowRight', cancelable:true}));
    }
    expect(component.avatarCropOffsetX).toBe(12.5);
    component.onCommunityAvatarCropKey(new KeyboardEvent('keydown', {key:'ArrowDown', cancelable:true}));
    expect(component.avatarCropOffsetY).toBe(2);
  });

  it('does not upload when selected community has changed since the crop opened', async () => {
    const gif = new File(['GIF89a'], 'animated.gif', {type:'image/gif'});
    component.onCommunityPhotoChange({ target: {files:[gif],value:'animated.gif'} } as any);
    component.selected = { id: 99, name: 'Other', myRole: 'OWNER' } as any;
    await component.saveCommunityAvatarCrop();
    expect(updatePhoto).not.toHaveBeenCalled();
  });

  it('keeps the edit dialog open to retry after failed upload', async () => {
    updatePhoto.and.returnValue(throwError(() => new Error('unavailable')));
    const gif = new File(['GIF89a'], 'animated.gif', {type:'image/gif'});
    component.onCommunityPhotoChange({ target: {files:[gif],value:'animated.gif'} } as any);
    await component.saveCommunityAvatarCrop();
    expect(component.avatarCropFile).toBe(gif);
    expect(component.avatarCropError).toBeTruthy();
    expect(component.photoUpdating).toBeFalse();
  });
});
