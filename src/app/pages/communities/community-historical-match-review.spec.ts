import { HistoricalMatchArchive } from '../../services/community-groups.service';
import { historicalMatchReviewFlags } from './community-historical-match-review';

describe('Historical source-fixture review flags', () => {
  function fixture(round: string, homeScore: number, awayScore: number,
    potentialDuplicate = false): HistoricalMatchArchive['rows'][number] {
    return {
      sourceRow: 48, home: 'Águias', away: 'Lobos',
      sourceRound: round, homeScore, awayScore,
      sourceDate: '2024-05-10', potentialDuplicate
    };
  }

  it('flags a potential duplicate but never changes the historical source row', () => {
    const row = fixture('Final', 2, 1, true);
    const snapshot = JSON.stringify(row);
    expect(historicalMatchReviewFlags(row, true)).toEqual(['possible-duplicate']);
    expect(JSON.stringify(row)).toBe(snapshot);
  });

  it('flags explicitly labelled tied quarterfinals, semifinals and finals', () => {
    for (const name of ['Quartos de final', '1/4 final', 'Meias-finais',
      'Semifinal 2', 'Grande Final']) {
      expect(historicalMatchReviewFlags(fixture(name, 2, 2), true))
        .withContext(name).toEqual(['tied-knockout']);
    }
  });

  it('shows both independent observations when a knockout row is tied and duplicated', () => {
    expect(historicalMatchReviewFlags(fixture('Final', 1, 1, true), true))
      .toEqual(['possible-duplicate', 'tied-knockout']);
  });

  it('never flags an ordinary league draw as an unresolved knockout', () => {
    expect(historicalMatchReviewFlags(fixture('Jornada 1', 0, 0), false)).toEqual([]);
    expect(historicalMatchReviewFlags(fixture('Final', 1, 1), false)).toEqual([]);
    expect(historicalMatchReviewFlags(fixture('Jornada 2', 1, 1), true)).toEqual([]);
  });

  it('does not mislabel a decisive knockout match or invent an unlabelled stage', () => {
    expect(historicalMatchReviewFlags(fixture('Final', 3, 2), true)).toEqual([]);
    expect(historicalMatchReviewFlags(fixture('', 1, 1), true)).toEqual([]);
  });

  it('does not treat a possible duplicate as a confirmed invalid match', () => {
    expect(historicalMatchReviewFlags(fixture('Jornada 2', 2, 2, true), false))
      .toEqual(['possible-duplicate']);
  });
});
