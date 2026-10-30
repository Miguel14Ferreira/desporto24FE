import { HistoricalMatchArchive } from '../../services/community-groups.service';
import { historicalKnockoutPhaseOverview } from './community-historical-knockout-overview';

describe('Historical knockout phase navigation from source labels', () => {
  const match = (
    sourceRow: number, sourceRound: string, homeScore = 2,
    awayScore = 1, potentialDuplicate = false
  ): HistoricalMatchArchive['rows'][number] => ({
    sourceRow, home: 'Águias', away: 'Lobos', homeScore, awayScore,
    sourceRound, sourceDate: '2024-04-11', potentialDuplicate
  });
  const archive = (rows: HistoricalMatchArchive['rows']): HistoricalMatchArchive => ({
    id: 4, title: 'Histórico', entryType: 'TEAM',
    sourceFilename: 'edicao.xlsx', createdAt: '2026-10-24T00:00:00Z', rows
  });

  it('counts only explicitly labelled quarterfinals, semifinals and finals', () => {
    const input = archive([
      match(2, 'Quartos de final'), match(3, 'Quarter-final 2'),
      match(4, '1/4 final 3'), match(5, 'Quartas de finais 4'),
      match(6, 'Semifinal A'), match(7, 'Meias-finais'),
      match(8, 'Grande Final'), match(9, 'Jornada 1')
    ]);
    const result = historicalKnockoutPhaseOverview(input);
    expect(result.map(phase => phase.phase)).toEqual(['quarterfinal', 'semifinal', 'final']);
    expect(result.map(phase => phase.matchCount)).toEqual([4, 2, 1]);
    expect(result.map(phase => phase.singleLegReference)).toEqual([4, 2, 1]);
    expect(result.map(phase => phase.requiresReview)).toEqual([false, false, false]);
    expect(result.map(phase => phase.firstArchiveIndex)).toEqual([0, 4, 6]);
    expect(result[0].sourceLabels).toEqual([
      'Quartos de final', 'Quarter-final 2', '1/4 final 3', 'Quartas de finais 4'
    ]);
  });

  it('preserves source order and jumps to the first archive page, not source row', () => {
    const rows = Array.from({ length: 51 }, (_, i) => match(i + 200, 'Jornada 1'));
    rows.push(match(999, 'Meia-final 1'));
    rows.push(match(1000, 'Final'));
    rows.push(match(1001, 'Meia-final 2'));
    const result = historicalKnockoutPhaseOverview(archive(rows));
    expect(result.map(phase => phase.phase)).toEqual(['semifinal', 'final']);
    expect(result[0].matchCount).toBe(2);
    expect(result[0].firstArchiveIndex).toBe(51);
    expect(result[0].firstPage).toBe(1);
    expect(result[1].firstArchiveIndex).toBe(52);
    expect(result[1].firstPage).toBe(1);
    expect(rows.map(row => row.sourceRow).slice(-3)).toEqual([999, 1000, 1001]);
  });

  it('flags potentially duplicated and drawn fixtures without silently excluding them', () => {
    const result = historicalKnockoutPhaseOverview(archive([
      match(2, 'Quartos de final', 1, 1),
      match(3, 'Quartos de final', 1, 0, true),
      match(4, 'Final')
    ]));
    expect(result[0]).toEqual(jasmine.objectContaining({
      matchCount: 2, drawnResults: 1, potentialDuplicates: 1, requiresReview: true,
      reviewArchiveIndices: [0, 1]
    }));
    expect(result[1]).toEqual(jasmine.objectContaining({
      phase: 'final', matchCount: 1, drawnResults: 0, requiresReview: false
    }));
  });

  it('retains source-order review row indices across 50-row page boundaries', () => {
    const rows = Array.from({ length: 49 }, (_, index) =>
      match(index + 300, 'Jornada antiga'));
    rows.push(match(900, 'Quartos de final', 1, 1));
    rows.push(match(901, 'Quartos de final', 2, 0));
    rows.push(match(902, 'Quarter-final 2', 2, 2, true));
    rows.push(match(903, 'Final', 1, 0));

    const before = JSON.stringify(rows);
    const [quarter, final] = historicalKnockoutPhaseOverview(archive(rows));
    expect(quarter.reviewArchiveIndices).toEqual([49, 51]);
    expect(quarter.matchCount).toBe(3);
    expect(quarter.firstPage).toBe(0);
    expect(quarter.reviewArchiveIndices.map(index => Math.floor(index / 50))).toEqual([0, 1]);
    expect(final.reviewArchiveIndices).toEqual([]);
    expect(JSON.stringify(rows)).toBe(before);
  });

  it('distinguishes a source count mismatch from a flag on an individual fixture', () => {
    const [quarter] = historicalKnockoutPhaseOverview(archive([
      match(8, 'Quartos de final', 2, 1)
    ]));
    expect(quarter.requiresReview).toBeTrue();
    expect(quarter.reviewArchiveIndices).toEqual([]);
  });

  it('does not invent absent stages or treat unlabelled matches as a final', () => {
    const result = historicalKnockoutPhaseOverview(archive([
      match(2, ''), match(3, 'Jornada 1'), match(4, 'Quartas de final da escola')
    ]));
    expect(result).toEqual([]); // No invented phases or empty stage cards.
  });

  it('leaves the immutable spreadsheet snapshot untouched', () => {
    const input = archive([match(2, 'Final'), match(3, 'Final', 1, 1, true)]);
    const before = JSON.stringify(input);
    historicalKnockoutPhaseOverview(input);
    expect(JSON.stringify(input)).toBe(before);
  });
});
