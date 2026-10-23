import { sportForRound, viewForSport } from './community-round-sport';

describe('community rounds adapt to their discipline', () => {
  it('shows football and futsal as team games but karting as a race', () => {
    expect(viewForSport('Futsal')).toBe('team');
    expect(viewForSport('Futebol')).toBe('team');
    expect(viewForSport('Karting')).toBe('race');
    expect(viewForSport('Karts')).toBe('race');
    expect(viewForSport('Automobilismo')).toBe('race');
    expect(viewForSport('Ténis')).toBe('individual');
  });
  it('uses the round sport, never the first modality of a mixed-sport community', () => {
    const group = { sport: 'Futsal', sports: ['Futsal', 'Karting'] };
    expect(sportForRound({ sport: 'Karting' }, group)).toBe('Karting');
    expect(sportForRound({ sport: null }, group)).toBeNull();
    expect(viewForSport(sportForRound({ sport: null }, group))).toBe('unknown');
  });
  it('still reads older single-sport rounds without rewriting their history', () => {
    expect(sportForRound({ sport: null }, { sport: 'Futsal', sports: ['Futsal'] })).toBe('Futsal');
    expect(sportForRound({ sport: null }, { sport: null, sports: [] })).toBeNull();
  });
});
