import { acceptsCommunityAvatar, communityAvatarUploadError, MAX_COMMUNITY_AVATAR_BYTES } from './community-avatar-upload';

describe('community avatar upload', () => {
  it('accepts animated GIF as well as the three existing photo types', () => {
    for (const type of ['image/gif', 'image/jpeg', 'image/png', 'image/webp']) {
      expect(acceptsCommunityAvatar({ type, size: 1000 }))
        .withContext(type).toBeTrue();
    }
  });

  it('rejects oversized, empty, video, SVG and spoofed MIME types', () => {
    expect(acceptsCommunityAvatar({ type: 'image/gif', size: MAX_COMMUNITY_AVATAR_BYTES + 1 })).toBeFalse();
    expect(acceptsCommunityAvatar({ type: 'image/gif', size: 0 })).toBeFalse();
    expect(acceptsCommunityAvatar({ type: 'image/svg+xml', size: 123 })).toBeFalse();
    expect(acceptsCommunityAvatar({ type: 'video/mp4', size: 123 })).toBeFalse();
    expect(acceptsCommunityAvatar({ type: 'application/octet-stream', size: 123 })).toBeFalse();
  });
  it('explains MP4 upload failures instead of a generic image error', () => {
    expect(communityAvatarUploadError({ name: 'ACM_Teams_large_preview(1).mp4',
      type: 'video/mp4', size: 2_513_303 })).toBe('VIDEO');
    expect(communityAvatarUploadError({ name: 'clip.mov',
      type: '', size: 2_000 })).toBe('VIDEO');
  });

  it('distinguishes oversize GIFs from unsupported files', () => {
    expect(communityAvatarUploadError({ name: 'logo.gif',
      type: 'image/gif', size: MAX_COMMUNITY_AVATAR_BYTES + 1 })).toBe('TOO_LARGE');
    expect(communityAvatarUploadError({ name: 'logo.svg',
      type: 'image/svg+xml', size: 200 })).toBe('INVALID');
    expect(communityAvatarUploadError({ name: 'logo.gif',
      type: 'image/gif', size: 1_000 })).toBeNull();
  });

});
