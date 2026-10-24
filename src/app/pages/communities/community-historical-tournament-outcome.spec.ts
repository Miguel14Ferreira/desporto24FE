import { HistoricalMatchArchive } from '../../services/community-groups.service';
import { historicalTournamentOutcome } from './community-historical-tournament-outcome';

describe('Historic tournament outcome from original spreadsheet', () => {
  const row = (
    sourceRow: number, home: string, away: string, homeScore: number,
    awayScore: number, sourceRound = 'J1', potentialDuplicate = false
  ) => ({
    sourceRow, home, away, homeScore, awayScore,
    sourceDate: '2024-05-10', sourceRound, potentialDuplicate
  });
  const archive = (rows: HistoricalMatchArchive['rows']): HistoricalMatchArchive => ({
    id: 9, title: 'CNG 2024', entryType: 'TEAM',
    sourceFilename: 'historico.xlsx', createdAt: '2026-10-24T00:00:00Z', rows
  });

  const outcome = (item: HistoricalMatchArchive, format: 'LEAGUE' | 'KNOCKOUT',
    sport = 'Futebol') => historicalTournamentOutcome(item, format, sport);

  it('refuses to apply generic football scoring to sports with incompatible formats', () => {
    const games = archive([
      row(2, 'A', 'B', 2, 1, 'Final')
    ]);
    for (const sport of ['Karting', 'Golfe', 'Xadrez', 'Modalidade desconhecida']) {
      const result = outcome(games, 'KNOCKOUT', sport);
      expect(result.reason).withContext(sport).toBe('unsupported-sport');
      expect(result.winner).toBeNull();
    }
  });

  it('estimates a winner only from a complete league with a unique points leader', () => {
    const result = outcome(archive([
      row(2, 'Águias', 'Lobos', 2, 1),
      row(3, 'Lobos', 'CNG', 2, 0),
      row(4, 'CNG', 'Águias', 0, 3)
    ]), 'LEAGUE');
    expect(result).toEqual({ winner: 'Águias', reason: 'winner-estimated', matchesUsed: 3 });
  });

  it('does not invent a champion when any league matchup is missing', () => {
    const result = outcome(archive([
      row(2, 'Águias', 'Lobos', 2, 0),
      row(3, 'Lobos', 'CNG', 2, 0)
    ]), 'LEAGUE');
    expect(result.reason).toBe('incomplete-fixtures');
    expect(result.winner).toBeNull();
  });

  it('rejects uneven home and away fixture counts even if enough rows exist', () => {
    const result = outcome(archive([
      row(2, 'Águias', 'Lobos', 2, 0),
      row(3, 'Lobos', 'Águias', 1, 0),
      row(4, 'Águias', 'CNG', 2, 0),
      row(5, 'Lobos', 'CNG', 2, 0)
    ]), 'LEAGUE');
    expect(result.reason).toBe('incomplete-fixtures');
  });

  it('does not decide equal-point leaders using a sport-specific tie break', () => {
    const result = outcome(archive([
      row(2, 'A', 'B', 1, 0),
      row(3, 'B', 'C', 2, 0),
      row(4, 'C', 'A', 1, 0)
    ]), 'LEAGUE');
    expect(result.reason).toBe('tied-leaders');
    expect(result.winner).toBeNull();
  });

  it('refuses to infer a winner while duplicates require review', () => {
    const result = outcome(archive([
      row(2, 'Águias', 'Lobos', 3, 0),
      row(3, 'Águias', 'Lobos', 3, 0, 'J1', true)
    ]), 'LEAGUE');
    expect(result.reason).toBe('potential-duplicates');
    expect(result.winner).toBeNull();
  });

  it('recognizes a decisive labelled final without misreading semifinals', () => {
    const result = outcome(archive([
      row(2, 'A', 'B', 3, 1, 'Semifinal'),
      row(3, 'C', 'D', 1, 0, 'Meia-final'),
      row(4, 'A', 'C', 2, 0, 'Grande Final')
    ]), 'KNOCKOUT');
    expect(result.winner).toBe('A');
    expect(result.reason).toBe('winner-estimated');
  });

  it('does not assign a knockout champion without a decisive unambiguous final', () => {
    expect(outcome(archive([
      row(2, 'A', 'B', 3, 1, 'Semifinal')
    ]), 'KNOCKOUT').reason).toBe('missing-final');
    expect(outcome(archive([
      row(2, 'A', 'B', 1, 1, 'Final')
    ]), 'KNOCKOUT').reason).toBe('drawn-final');
    expect(outcome(archive([
      row(2, 'A', 'B', 2, 1, 'Final'),
      row(3, 'C', 'D', 1, 0, 'Final')
    ]), 'KNOCKOUT').reason).toBe('multiple-finals');
  });

  it('accepts a decisive final only when both explicitly labelled semifinals feed it', () => {
    const result = outcome(archive([
      row(2, 'Águias', 'Lobos', 2, 1, 'Meia-final 1'),
      row(3, 'CNG', 'Tigres', 3, 0, 'Semi Final 2'),
      row(4, 'Águias', 'CNG', 1, 0, 'Final')
    ]), 'KNOCKOUT');
    expect(result).toEqual({ winner: 'Águias', reason: 'winner-estimated', matchesUsed: 3 });
  });

  it('rejects a final with a finalist eliminated in the source semifinals', () => {
    const result = outcome(archive([
      row(2, 'A', 'B', 0, 1, 'Semifinal'),
      row(3, 'C', 'D', 4, 0, 'Meias-finais'),
      row(4, 'A', 'C', 2, 0, 'Final')
    ]), 'KNOCKOUT');
    expect(result.winner).toBeNull();
    expect(result.reason).toBe('semifinal-final-mismatch');
  });

  it('does not infer a champion from an incomplete pair of labelled semifinals', () => {
    const result = outcome(archive([
      row(2, 'A', 'B', 2, 0, 'Semi-final'),
      row(3, 'A', 'C', 1, 0, 'Final')
    ]), 'KNOCKOUT');
    expect(result).toEqual({ winner: null, reason: 'incomplete-semifinals', matchesUsed: 2 });
  });

  it('rejects a semifinal draw because its actual winner needs independent evidence', () => {
    const result = outcome(archive([
      row(2, 'A', 'B', 1, 1, 'Meia-final'),
      row(3, 'C', 'D', 2, 1, 'Semifinal'),
      row(4, 'A', 'C', 3, 0, 'Final')
    ]), 'KNOCKOUT');
    expect(result.reason).toBe('drawn-semifinal');
    expect(result.winner).toBeNull();
  });

  it('does not accept duplicated or overlapping semifinal participants', () => {
    const result = outcome(archive([
      row(2, 'A', 'B', 1, 0, '1/2 final'),
      row(3, 'A', 'C', 1, 0, '1/2 finais'),
      row(4, 'A', 'C', 2, 1, 'Grande Final')
    ]), 'KNOCKOUT');
    expect(result.reason).toBe('semifinal-final-mismatch');
    expect(result.winner).toBeNull();
  });

  it('recognizes participants across rounds with different case and diacritics', () => {
    const result = outcome(archive([
      row(2, 'Águias', 'Lobos', 1, 0, 'Semifinal A'),
      row(3, 'CNG', 'Tigres', 1, 0, 'Semifinal B'),
      row(4, '  aguias  ', 'cng', 2, 0, 'Final')
    ]), 'KNOCKOUT');
    expect(result.reason).toBe('winner-estimated');
    expect(result.winner).toBe('aguias');
  });

  it('does not invent missing semifinal fixtures for a final-only archive', () => {
    const result = outcome(archive([
      row(2, 'A', 'B', 2, 1, 'Final')
    ]), 'KNOCKOUT');
    expect(result.reason).toBe('winner-estimated');
    expect(result.winner).toBe('A');
  });

  it('leaves the source archive unchanged', () => {
    const item = archive([row(2, 'Águias', 'Lobos', 1, 0, 'Final')]);
    const before = JSON.stringify(item);
    outcome(item, 'KNOCKOUT');
    expect(JSON.stringify(item)).toBe(before);
  });
});
