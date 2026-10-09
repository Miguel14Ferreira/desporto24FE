import { sportIcon } from './sports-catalog';

describe('sportIcon', () => {
  it('uses the American football ball before the general football match', () => {
    expect(sportIcon('Futebol Americano')).toBe('🏈');
    expect(sportIcon('FUTEBOL AMERICANO')).toBe('🏈');
    expect(sportIcon('Football Americano')).toBe('🏈');
  });

  it('keeps the football and rugby balls for their respective sports', () => {
    expect(sportIcon('Futebol')).toBe('⚽');
    expect(sportIcon('Futsal')).toBe('⚽');
    expect(sportIcon('Futevólei')).toBe('⚽');
    expect(sportIcon('Rugby')).toBe('🏉');
  });
});
