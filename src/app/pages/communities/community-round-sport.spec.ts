import { SPORTS_CATALOG } from '../../shared/sports-catalog';
import { formatForSport, sportForRound, SPORTS_BY_RESULT_FORMAT, viewForSport } from './community-round-sport';

describe('community round sport profiles cover the complete supported catalogue', () => {
  it('assigns every supported sport to one explicit result format', () => {
    const list = Object.values(SPORTS_BY_RESULT_FORMAT).flat();
    expect(list.length).toBe(SPORTS_CATALOG.length);
    expect(new Set(list).size).toBe(list.length);
    expect([...list].sort()).toEqual([...SPORTS_CATALOG].sort());
    for (const sport of SPORTS_CATALOG) {
      expect(formatForSport(sport)).withContext(sport).not.toBe('unknown');
    }
  });

  it('keeps all 7 sport families distinct while preserving football and karting screens', () => {
    expect(formatForSport('Futsal')).toBe('team');
    expect(formatForSport('Basquetebol')).toBe('team');
    expect(formatForSport('Karting')).toBe('race');
    expect(formatForSport('Ciclismo')).toBe('race');
    expect(formatForSport('Natação')).toBe('race');
    expect(formatForSport('Padel')).toBe('duel');
    expect(formatForSport('Ténis')).toBe('duel');
    expect(formatForSport('Surf')).toBe('judged');
    expect(formatForSport('Golfe')).toBe('score');
    expect(formatForSport('Atletismo')).toBe('measured');
    expect(formatForSport('Yoga')).toBe('activity');
    expect(viewForSport('Futsal')).toBe('team');
    expect(viewForSport('Karting')).toBe('race');
    expect(viewForSport('Karts')).toBe('race');
    expect(viewForSport('Ténis')).toBe('individual');
  });

  it('keeps unknown sports neutral, never silently uses another sport scoring', () => {
    expect(formatForSport('Nova Modalidade Sem Configuração')).toBe('unknown');
    expect(viewForSport('Nova Modalidade Sem Configuração')).toBe('unknown');
    expect(formatForSport(null)).toBe('unknown');
  });

  it('uses the recorded round sport, not the first sport of a multi-sport group', () => {
    const group = { sport: 'Futsal', sports: ['Futsal', 'Karting'] };
    expect(sportForRound({ sport: 'Karting' }, group)).toBe('Karting');
    expect(sportForRound({ sport: null }, group)).toBeNull();
    expect(viewForSport(sportForRound({ sport: null }, group))).toBe('unknown');
  });

  it('keeps historical single-sport rounds readable without altering their data', () => {
    expect(sportForRound({ sport: null }, { sport: 'Futsal', sports: ['Futsal'] })).toBe('Futsal');
    expect(sportForRound({ sport: null }, { sport: null, sports: [] })).toBeNull();
  });
});
