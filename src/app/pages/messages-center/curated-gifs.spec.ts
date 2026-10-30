import { CURATED_GIPHY_GIFS, findCuratedGifs } from './curated-gifs';
import { encodeGiphyText, readGiphyText } from './gif-picker.client';

describe('GIPHY reaction categories without API configuration', () => {
  const categories = ['funny','love','football','yes','celebration','victory'];
  it('provides multiple clickable GIF choices for all six categories', () => {
    for (const category of categories) {
      const matches = findCuratedGifs(category);
      expect(matches.length).withContext(category).toBeGreaterThanOrEqual(1);
      expect(matches.every(x => CURATED_GIPHY_GIFS.some(item => item.id === x.id))).toBeTrue();
      for (const gif of matches) {
        const text = encodeGiphyText(gif, '');
        expect(text).withContext(gif.id).toContain('[JYNLO:GIPHY:1]');
        expect(readGiphyText(text)?.id).toBe(gif.id);
        expect(gif.pageUrl).toContain('https://giphy.com/gifs/');
      }
    }
  });
  it('filters locally and restores all GIFs after clearing search', () => {
    expect(findCuratedGifs('CAMPEÃO').length).toBeGreaterThan(0);
    expect(findCuratedGifs('não há este gif')).toEqual([]);
    expect(findCuratedGifs('')).toHaveSize(CURATED_GIPHY_GIFS.length);
  });
});
