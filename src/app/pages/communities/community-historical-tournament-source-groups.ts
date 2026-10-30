import { HistoricalMatchArchive } from '../../services/community-groups.service';

export interface HistoricalTournamentSourceGroup {
  /** Exact, visible phase/round text from the source, never an inferred bracket. */
  sourceRound: string | null;
  firstSourceRow: number;
  rows: HistoricalMatchArchive['rows'];
}

/**
 * Present original historical fixtures as contiguous source-defined sections.
 * A label which reappears later starts another section rather than moving
 * matches to make a bracket or reordering the uploaded file.
 *
 * Missing labels remain unlabelled; we must not invent rounds or stages.
 * The returned arrays are new, leaving the immutable archive untouched.
 */
export function groupHistoricalTournamentSourceRows(
  rows: readonly HistoricalMatchArchive['rows'][number][]
): HistoricalTournamentSourceGroup[] {
  const groups: HistoricalTournamentSourceGroup[] = [];
  for (const row of rows) {
    const sourceRound = row.sourceRound?.trim() || null;
    const previous = groups[groups.length - 1];
    if (previous && previous.sourceRound === sourceRound) {
      previous.rows.push(row);
    } else {
      groups.push({ sourceRound, firstSourceRow: row.sourceRow, rows: [row] });
    }
  }
  return groups;
}
