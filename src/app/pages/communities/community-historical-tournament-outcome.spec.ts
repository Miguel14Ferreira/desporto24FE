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


  const completeKnockout = () => [
    row(2, 'Águias', 'B', 2, 0, 'Quartos de final 1'),
    row(3, 'C', 'D', 3, 1, 'Quarter-final 2'),
    row(4, 'E', 'F', 1, 0, '1/4 final 3'),
    row(5, 'G', 'H', 2, 0, 'Quartas de finais 4'),
    row(6, 'Águias', 'C', 2, 1, 'Meia-final 1'),
    row(7, 'E', 'G', 1, 0, 'Semifinal 2'),
    row(8, '  aguias  ', 'E', 3, 0, 'Grande Final')
  ];

  it('validates four explicit quarters through two semifinals into the final', () => {
    const result = outcome(archive(completeKnockout()), 'KNOCKOUT');
    expect(result).toEqual({ winner: 'aguias', reason: 'winner-estimated', matchesUsed: 7 });
  });

  it('does not infer a winner if a quarterfinal winner is absent from semifinals', () => {
    const matches = completeKnockout();
    matches[0] = row(2, 'Águias', 'B', 0, 2, 'Quartos de final 1');
    const result = outcome(archive(matches), 'KNOCKOUT');
    expect(result.winner).toBeNull();
    expect(result.reason).toBe('quarterfinal-semifinal-mismatch');
  });

  it('rejects incomplete quarterfinal evidence rather than inventing missing fixtures', () => {
    const matches = completeKnockout().filter(match => match.sourceRow !== 5);
    const result = outcome(archive(matches), 'KNOCKOUT');
    expect(result.winner).toBeNull();
    expect(result.reason).toBe('incomplete-quarterfinals');
  });

  it('refuses to decide a tied quarterfinal without an imported tiebreak', () => {
    const matches = completeKnockout();
    matches[1] = row(3, 'C', 'D', 1, 1, 'Quarter-final 2');
    const result = outcome(archive(matches), 'KNOCKOUT');
    expect(result.winner).toBeNull();
    expect(result.reason).toBe('drawn-quarterfinal');
  });

  it('does not reconstruct unlabelled semifinals from quarterfinals and the final', () => {
    const matches = completeKnockout().filter(match =>
      match.sourceRow < 6 || match.sourceRow === 8);
    const result = outcome(archive(matches), 'KNOCKOUT');
    expect(result.winner).toBeNull();
    expect(result.reason).toBe('missing-semifinals-after-quarterfinals');
  });

  it('rejects repeated entrants in separate quarterfinal fixtures', () => {
    const matches = completeKnockout();
    matches[3] = row(5, 'Águias', 'H', 2, 0, 'Quartas de finais 4');
    const result = outcome(archive(matches), 'KNOCKOUT');
    expect(result.winner).toBeNull();
    expect(result.reason).toBe('quarterfinal-semifinal-mismatch');
  });

  it('does not treat unlabelled earlier matches as quarterfinals', () => {
    const matches = completeKnockout().slice(4);
    matches.unshift(row(1, 'I', 'J', 2, 1, 'Jornada 1'));
    const result = outcome(archive(matches), 'KNOCKOUT');
    expect(result.reason).toBe('winner-estimated');
    expect(result.winner).toBe('aguias');
  });

  it('never edits the source archive while validating quarterfinal progression', () => {
    const item = archive(completeKnockout());
    const snapshot = JSON.stringify(item);
    outcome(item, 'KNOCKOUT');
    expect(JSON.stringify(item)).toBe(snapshot);
  });

  it('leaves the source archive unchanged', () => {
    const item = archive([row(2, 'Águias', 'Lobos', 1, 0, 'Final')]);
    const before = JSON.stringify(item);
    outcome(item, 'KNOCKOUT');
    expect(JSON.stringify(item)).toBe(before);
  });
});
