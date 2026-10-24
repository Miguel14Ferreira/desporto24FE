/**
 * Community avatars can be animated GIFs. Other image uploads (posts, Stories,
 * personal profiles) keep their current type rules.
 */
export const MAX_COMMUNITY_AVATAR_BYTES = 5 * 1024 * 1024;

export function acceptsCommunityAvatar(file: Pick<File, 'type' | 'size'>): boolean {
  return ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)
    && file.size > 0
    && file.size <= MAX_COMMUNITY_AVATAR_BYTES;
}

/**
 * Provide a specific, actionable validation error before sending a file.
 * An MP4 video is not an image/GIF, even if it looks animated.
 */
export function communityAvatarUploadError(
  file: Pick<File, 'name' | 'type' | 'size'>
): 'VIDEO' | 'TOO_LARGE' | 'INVALID' | null {
  if (acceptsCommunityAvatar(file)) return null;
  if (file.type.toLowerCase().startsWith('video/')
      || /\.(mp4|m4v|mov|webm)$/i.test(file.name)) {
    return 'VIDEO';
  }
  if (file.size > MAX_COMMUNITY_AVATAR_BYTES) return 'TOO_LARGE';
  return 'INVALID';
}
