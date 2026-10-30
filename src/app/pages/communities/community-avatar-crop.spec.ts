import {
  avatarCanvasPosition, clampAvatarOffset, communityAvatarCrop,
  COMMUNITY_COVER_HEIGHT, COMMUNITY_COVER_WIDTH
} from './community-avatar-crop';

describe('Community avatar live crop and export', () => {
  it('uses a consistent 16:10 cover frame for portrait, landscape and square images', () => {
    for (const [w,h] of [[1200, 600], [800, 800], [300, 900]]) {
      const crop = communityAvatarCrop(w, h, 1);
      expect(crop.widthPercent).toBeGreaterThanOrEqual(100);
      expect(crop.heightPercent).toBeGreaterThanOrEqual(100);
      const drawing = avatarCanvasPosition(crop, 0, 0);
      expect(drawing.x).toBeLessThanOrEqual(0);
      expect(drawing.y).toBeLessThanOrEqual(0);
      expect(drawing.x + drawing.width).toBeGreaterThanOrEqual(COMMUNITY_COVER_WIDTH);
      expect(drawing.y + drawing.height).toBeGreaterThanOrEqual(COMMUNITY_COVER_HEIGHT);
    }
  });

  it('clamps dragging so the output never exposes blank edges', () => {
    const crop = communityAvatarCrop(400, 800, 2);
    const right = avatarCanvasPosition(crop, 10000, -10000);
    expect(right.x).toBeLessThanOrEqual(0);
    expect(right.y).toBeLessThanOrEqual(0);
    expect(right.x + right.width).toBeGreaterThanOrEqual(COMMUNITY_COVER_WIDTH);
    expect(right.y + right.height).toBeGreaterThanOrEqual(COMMUNITY_COVER_HEIGHT);
    expect(clampAvatarOffset(Infinity, 20)).toBe(0);
  });

  it('does not allow zooming below cover or above maximum zoom', () => {
    const small = communityAvatarCrop(1200, 600, -30);
    const cover = communityAvatarCrop(1200, 600, 1);
    expect(small.widthPercent).toBe(cover.widthPercent);
    const large = communityAvatarCrop(1200, 600, 60);
    expect(large.scaledWidth).toBeCloseTo(cover.scaledWidth * 3);
  });

  it('rejects invalid image geometry', () => {
    expect(() => communityAvatarCrop(0, 900, 1)).toThrow();
    expect(() => communityAvatarCrop(900, NaN, 1)).toThrow();
  });
});
