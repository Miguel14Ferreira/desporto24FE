import { HistoricalMatchArchive } from '../../services/community-groups.service';
import { groupHistoricalTournamentSourceRows } from './community-historical-tournament-source-groups';

describe('Grouping historical tournament fixtures by source round or phase', () => {
  const match = (sourceRow: number, sourceRound: string | null, potentialDuplicate = false):
    HistoricalMatchArchive['rows'][number] => ({
    sourceRow,
    home: 'Águias', away: 'Lobos', homeScore: 2, awayScore: 1,
    sourceRound: sourceRound ?? '', sourceDate: '2024-05-01', potentialDuplicate
  });

  it('retains the source order of labelled knockout stages, including reappearing stages', () => {
    const rows = [
      match(2, 'Quartos de final'), match(3, 'Quartos de final'),
      match(4, 'Meias-finais'), match(5, 'Final'),
      match(6, 'Quartos de final')
    ];
    const groups = groupHistoricalTournamentSourceRows(rows);
    expect(groups.map(group => group.sourceRound))
      .toEqual(['Quartos de final', 'Meias-finais', 'Final', 'Quartos de final']);
    expect(groups.map(group => group.rows.map(row => row.sourceRow)))
      .toEqual([[2, 3], [4], [5], [6]]);
  });

  it('keeps unlabelled matches unlabelled instead of inventing a phase', () => {
    const groups = groupHistoricalTournamentSourceRows([
      match(2, null), match(3, '  '), match(4, ' Jornada 1 ')
    ]);
    expect(groups.map(group => group.sourceRound)).toEqual([null, 'Jornada 1']);
    expect(groups[0].rows).toHaveSize(2);
  });

  it('retains flagged potential duplicates visibly and never edits imported rows', () => {
    const rows = [match(2, 'J1'), match(3, 'J1', true)];
    const before = JSON.stringify(rows);
    const groups = groupHistoricalTournamentSourceRows(rows);
    expect(groups[0].rows.map(row => row.potentialDuplicate)).toEqual([false, true]);
    expect(JSON.stringify(rows)).toBe(before);
    expect(groups[0].rows).not.toBe(rows);
  });

  it('respects the existing 50-match page boundary', () => {
    const rows = Array.from({ length: 52 }, (_, i) => match(i + 2, 'J1'));
    const groups = groupHistoricalTournamentSourceRows(rows.slice(50, 100));
    expect(groups).toHaveSize(1);
    expect(groups[0].rows.map(row => row.sourceRow)).toEqual([52, 53]);
  });

  it('works with empty archives', () => {
    expect(groupHistoricalTournamentSourceRows([])).toEqual([]);
  });
});
