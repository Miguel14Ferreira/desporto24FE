/** Shared between the live preview and the JPEG exported to the API. */
export const COMMUNITY_COVER_WIDTH = 960;
export const COMMUNITY_COVER_HEIGHT = 600;
export const COMMUNITY_AVATAR_MAX_ZOOM = 3;

export interface CommunityAvatarCrop {
  widthPercent: number;
  heightPercent: number;
  maxOffsetX: number;
  maxOffsetY: number;
  scaledWidth: number;
  scaledHeight: number;
}

export function communityAvatarCrop(
  imageWidth: number, imageHeight: number, zoom: number
): CommunityAvatarCrop {
  if (!Number.isFinite(imageWidth) || !Number.isFinite(imageHeight)
    || imageWidth <= 0 || imageHeight <= 0) {
    throw new Error('Invalid community photo dimensions');
  }
  const boundedZoom = Math.max(1, Math.min(COMMUNITY_AVATAR_MAX_ZOOM, zoom));
  const baseScale = Math.max(COMMUNITY_COVER_WIDTH / imageWidth, COMMUNITY_COVER_HEIGHT / imageHeight);
  const scaledWidth = imageWidth * baseScale * boundedZoom;
  const scaledHeight = imageHeight * baseScale * boundedZoom;
  const widthPercent = scaledWidth / COMMUNITY_COVER_WIDTH * 100;
  const heightPercent = scaledHeight / COMMUNITY_COVER_HEIGHT * 100;
  return {
    widthPercent,
    heightPercent,
    maxOffsetX: Math.max(0, (widthPercent - 100) / 2),
    maxOffsetY: Math.max(0, (heightPercent - 100) / 2),
    scaledWidth,
    scaledHeight
  };
}

export function clampAvatarOffset(value: number, maximum: number): number {
  return Number.isFinite(value) ? Math.max(-maximum, Math.min(maximum, value)) : 0;
}

export function avatarCanvasPosition(
  crop: CommunityAvatarCrop, offsetXPercent: number, offsetYPercent: number
): { x: number; y: number; width: number; height: number } {
  return {
    x: (COMMUNITY_COVER_WIDTH - crop.scaledWidth) / 2
      + clampAvatarOffset(offsetXPercent, crop.maxOffsetX) / 100 * COMMUNITY_COVER_WIDTH,
    y: (COMMUNITY_COVER_HEIGHT - crop.scaledHeight) / 2
      + clampAvatarOffset(offsetYPercent, crop.maxOffsetY) / 100 * COMMUNITY_COVER_HEIGHT,
    width: crop.scaledWidth,
    height: crop.scaledHeight
  };
}
