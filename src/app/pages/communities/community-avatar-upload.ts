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
