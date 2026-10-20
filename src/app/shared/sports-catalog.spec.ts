import { SPORTS_CATALOG, sportIcon } from './sports-catalog';

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

describe('sports catalogue additions for audited Cascais venues', () => {
  const addedSports = [
    'Bowling', 'Corrida de obstáculos', 'Hipismo', 'Teqball', 'Ténis de praia'
  ];

  it('makes each new activity available in the sport picker', () => {
    for (const sport of addedSports) {
      expect(SPORTS_CATALOG).toContain(sport);
      expect(SPORTS_CATALOG.filter(item => item === sport)).toHaveSize(1);
    }
  });

  it('uses recognizable sport icons', () => {
    expect(sportIcon('Bowling')).toBe('🎳');
    expect(sportIcon('Hipismo')).toBe('🐎');
    expect(sportIcon('Teqball')).toBe('⚽');
    expect(sportIcon('Ténis de praia')).toBe('🎾');
    expect(sportIcon('Corrida de obstáculos')).toBe('🏃');
  });
});
