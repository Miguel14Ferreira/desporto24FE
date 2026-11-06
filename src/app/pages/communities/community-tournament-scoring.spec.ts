import { tournamentScoreTerminology } from './community-tournament-scoring';

describe('Sport-aware tournament score terminology', () => {
  it('labels results using their sport rather than a football fallback', () => {
    const examples: Array<[string, string, string]> = [
      ['Futebol', 'Golos marcados', 'GM'],
      ['Corfebol', 'Golos marcados', 'GM'],
      ['Lacrosse', 'Golos marcados', 'GM'],
      ['Basquetebol 3x3', 'Pontos marcados', 'PM'],
      ['Futebol Americano', 'Pontos marcados', 'PM'],
      ['Flag Football', 'Pontos marcados', 'PM'],
      ['Futevólei', 'Sets ganhos', 'SG'],
      ['Voleibol de Praia', 'Sets ganhos', 'SG'],
      ['Basebol', 'Corridas marcadas', 'CM'],
      ['Softbol', 'Corridas marcadas', 'CM'],
      ['Cricket', 'Corridas marcadas', 'CM'],
      ['Rugby Sevens', 'Pontos marcados', 'PM'],
      ['Teqball', 'Sets ganhos', 'SG']
    ];
    for (const [sport, title, abbrev] of examples) {
      const terminology = tournamentScoreTerminology(sport);
      expect(terminology.forTitle).withContext(sport).toBe(title);
      expect(terminology.forAbbrev).withContext(sport).toBe(abbrev);
      expect(terminology.note).withContext(sport).toContain('Formato atual:');
    }
  });

  it('does not invent a football scoring model for unrecognised sports', () => {
    const unknown = tournamentScoreTerminology('Modalidade sem regras');
    expect(unknown.forTitle).toBe('Marcador a favor');
    expect(unknown.note).toContain('Confirma');
  });

  it('tolerates accents, spaces and missing input', () => {
    expect(tournamentScoreTerminology('  FUTEVOLEI ').forAbbrev).toBe('SG');
    expect(tournamentScoreTerminology('  TEQBALL ').forAbbrev).toBe('SG');
    expect(tournamentScoreTerminology(null).forAbbrev).toBe('MF');
  });
});
