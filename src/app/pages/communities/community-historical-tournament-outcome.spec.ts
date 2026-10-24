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

  it('estimates a winner only from a complete league with a unique points leader', () => {
    const result = historicalTournamentOutcome(archive([
      row(2, 'Águias', 'Lobos', 2, 1),
      row(3, 'Lobos', 'CNG', 2, 0),
      row(4, 'CNG', 'Águias', 0, 3)
    ]), 'LEAGUE');
    expect(result).toEqual({ winner: 'Águias', reason: 'winner-estimated', matchesUsed: 3 });
  });

  it('does not invent a champion when any league matchup is missing', () => {
    const result = historicalTournamentOutcome(archive([
      row(2, 'Águias', 'Lobos', 2, 0),
      row(3, 'Lobos', 'CNG', 2, 0)
    ]), 'LEAGUE');
    expect(result.reason).toBe('incomplete-fixtures');
    expect(result.winner).toBeNull();
  });

  it('rejects uneven home and away fixture counts even if enough rows exist', () => {
    const result = historicalTournamentOutcome(archive([
      row(2, 'Águias', 'Lobos', 2, 0),
      row(3, 'Lobos', 'Águias', 1, 0),
      row(4, 'Águias', 'CNG', 2, 0),
      row(5, 'Lobos', 'CNG', 2, 0)
    ]), 'LEAGUE');
    expect(result.reason).toBe('incomplete-fixtures');
  });

  it('does not decide equal-point leaders using a sport-specific tie break', () => {
    const result = historicalTournamentOutcome(archive([
      row(2, 'A', 'B', 1, 0),
      row(3, 'B', 'C', 2, 0),
      row(4, 'C', 'A', 1, 0)
    ]), 'LEAGUE');
    expect(result.reason).toBe('tied-leaders');
    expect(result.winner).toBeNull();
  });

  it('refuses to infer a winner while duplicates require review', () => {
    const result = historicalTournamentOutcome(archive([
      row(2, 'Águias', 'Lobos', 3, 0),
      row(3, 'Águias', 'Lobos', 3, 0, 'J1', true)
    ]), 'LEAGUE');
    expect(result.reason).toBe('potential-duplicates');
    expect(result.winner).toBeNull();
  });

  it('recognizes a decisive labelled final without misreading semifinals', () => {
    const result = historicalTournamentOutcome(archive([
      row(2, 'A', 'B', 3, 1, 'Semifinal'),
      row(3, 'C', 'D', 1, 0, 'Meia-final'),
      row(4, 'A', 'C', 2, 0, 'Grande Final')
    ]), 'KNOCKOUT');
    expect(result.winner).toBe('A');
    expect(result.reason).toBe('winner-estimated');
  });

  it('does not assign a knockout champion without a decisive unambiguous final', () => {
    expect(historicalTournamentOutcome(archive([
      row(2, 'A', 'B', 3, 1, 'Semifinal')
    ]), 'KNOCKOUT').reason).toBe('missing-final');
    expect(historicalTournamentOutcome(archive([
      row(2, 'A', 'B', 1, 1, 'Final')
    ]), 'KNOCKOUT').reason).toBe('drawn-final');
    expect(historicalTournamentOutcome(archive([
      row(2, 'A', 'B', 2, 1, 'Final'),
      row(3, 'C', 'D', 1, 0, 'Final')
    ]), 'KNOCKOUT').reason).toBe('multiple-finals');
  });

  it('leaves the source archive unchanged', () => {
    const item = archive([row(2, 'Águias', 'Lobos', 1, 0, 'Final')]);
    const before = JSON.stringify(item);
    historicalTournamentOutcome(item, 'KNOCKOUT');
    expect(JSON.stringify(item)).toBe(before);
  });
});
