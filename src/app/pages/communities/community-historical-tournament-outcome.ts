import { HistoricalMatchArchive } from '../../services/community-groups.service';
import { HistoricalTournamentStanding, historicalTournamentStandings, canEstimateHistoricalLeagueStandings } from './community-historical-tournament-standings';

export type HistoricalTournamentOutcomeReason =
  | 'winner-estimated'
  | 'no-results'
  | 'unsupported-sport'
  | 'potential-duplicates'
  | 'incomplete-fixtures'
  | 'tied-leaders'
  | 'missing-final'
  | 'multiple-finals'
  | 'drawn-final'
  | 'incomplete-semifinals'
  | 'drawn-semifinal'
  | 'semifinal-final-mismatch'
  | 'incomplete-quarterfinals'
  | 'drawn-quarterfinal'
  | 'missing-semifinals-after-quarterfinals'
  | 'quarterfinal-semifinal-mismatch';

export interface HistoricalTournamentOutcome {
  /** A likely winner derived solely from original results; never an official title. */
  winner: string | null;
  reason: HistoricalTournamentOutcomeReason;
  matchesUsed: number;
}

/**
 * An import is a historic snapshot, not a verified official final table.
 * For league fixtures only infer a likely winner when every pairing has the
 * same 1 or 2 fixtures AND the leader has strictly more points than second.
 * Deliberately do not assume goal difference, sets or sport-specific tie breaks.
 *
 * For knockout infer only when a clearly labelled final has a decisive score.
 * When semifinals are explicitly present, verify that exactly two independent,
 * decisive semifinal winners match the two finalists. If quarterfinals are
 * explicitly present too, verify four unique and decisive fixtures that feed
 * the semifinal entrants. Do not infer missing stages or create an official title.
 * If the Excel has ambiguity, show why a winner cannot be reconstructed.
 */
export function historicalTournamentOutcome(
  archive: HistoricalMatchArchive,
  format: 'LEAGUE' | 'KNOCKOUT',
  sport: string | null | undefined,
  winPoints = 3,
  drawPoints = 1,
  lossPoints = 0
): HistoricalTournamentOutcome {
  const matches = archive.rows.filter(row => !row.potentialDuplicate);
  const pending = (reason: HistoricalTournamentOutcomeReason): HistoricalTournamentOutcome =>
    ({ winner: null, reason, matchesUsed: matches.length });

  if (!matches.length) return pending('no-results');
  if (!canEstimateHistoricalLeagueStandings(sport)) {
    return pending('unsupported-sport');
  }
  if (archive.rows.some(row => row.potentialDuplicate)) {
    return pending('potential-duplicates');
  }

  if (format === 'KNOCKOUT') {
    const finals = matches.filter(row => isHistoricalFinalRound(row.sourceRound));
    if (!finals.length) return pending('missing-final');
    if (finals.length !== 1) return pending('multiple-finals');
    const final = finals[0];
    if (final.homeScore === final.awayScore) return pending('drawn-final');

    // Only cross-check semifinals that the source explicitly labelled.
    // A final without semifinal rows remains a tentative *final-only* estimate.
    const semifinals = matches.filter(row => isSemifinalRound(row.sourceRound));
    if (semifinals.length) {
      if (semifinals.length !== 2) return pending('incomplete-semifinals');
      if (semifinals.some(row => row.homeScore === row.awayScore)) {
        return pending('drawn-semifinal');
      }

      const semifinalEntrants = semifinals.flatMap(row => [normalize(row.home), normalize(row.away)]);
      const semifinalWinners = semifinals.map(row =>
        normalize(row.homeScore > row.awayScore ? row.home : row.away));
      const finalists = [normalize(final.home), normalize(final.away)];

      // Each semifinal must involve different entrants; no entrant can play
      // both semifinals. The winners must be exactly the original finalists.
      if (semifinalEntrants.some(name => !name)
        || new Set(semifinalEntrants).size !== 4
        || finalists.some(name => !name)
        || new Set(finalists).size !== 2
        || new Set(semifinalWinners).size !== 2
        || semifinalWinners.some(name => !finalists.includes(name))) {
        return pending('semifinal-final-mismatch');
      }
    }
    // Validate quarterfinals only where the spreadsheet actually names them.
    // Do not reconstruct missing semifinal fixtures, aggregate home/away legs,
    // or award advancement after drawn fixtures without source evidence.
    const quarterfinals = matches.filter(row => isQuarterfinalRound(row.sourceRound));
    if (quarterfinals.length) {
      if (quarterfinals.length !== 4) return pending('incomplete-quarterfinals');
      if (quarterfinals.some(row => row.homeScore === row.awayScore)) {
        return pending('drawn-quarterfinal');
      }
      if (!semifinals.length) return pending('missing-semifinals-after-quarterfinals');

      const quarterfinalEntrants = quarterfinals.flatMap(row => [normalize(row.home), normalize(row.away)]);
      const quarterfinalWinners = quarterfinals.map(row =>
        normalize(row.homeScore > row.awayScore ? row.home : row.away));
      const semifinalEntrants = semifinals.flatMap(row => [normalize(row.home), normalize(row.away)]);

      // A valid four-match single-leg quarterfinal phase has eight distinct
      // entrants; each of its winners must be one of the four semifinalists.
      if (quarterfinalEntrants.some(name => !name)
        || new Set(quarterfinalEntrants).size !== 8
        || new Set(quarterfinalWinners).size !== 4
        || new Set(semifinalEntrants).size !== 4
        || quarterfinalWinners.some(name => !semifinalEntrants.includes(name))) {
        return pending('quarterfinal-semifinal-mismatch');
      }
    }
    return {
      winner: (final.homeScore > final.awayScore ? final.home : final.away).trim(),
      reason: 'winner-estimated',
      matchesUsed: matches.length
    };
  }

  const table: HistoricalTournamentStanding[] = historicalTournamentStandings(
    archive, winPoints, drawPoints, lossPoints
  );
  if (table.length < 2) return pending('incomplete-fixtures');

  // A complete round robin (1 or 2 legs) has exactly the same number of
  // matches for *each* unordered pairing. Merely counting total rows is not
  // enough: a spreadsheet may repeat one fixture while omitting another.
  const pairCounts = new Map<string, number>();
  for (const match of matches) {
    const pair = [normalize(match.home), normalize(match.away)].sort().join('\u0000');
    pairCounts.set(pair, (pairCounts.get(pair) || 0) + 1);
  }
  const expectedPairs = table.length * (table.length - 1) / 2;
  const counts = [...pairCounts.values()];
  const legs = counts[0];
  if (pairCounts.size !== expectedPairs ||
      (legs !== 1 && legs !== 2) ||
      counts.some(count => count !== legs)) {
    return pending('incomplete-fixtures');
  }
  // Points ties need the original tournament's tie-break rules, which are not
  // necessarily goal difference. Never choose a champion from alphabetical order.
  if (table[0].points === table[1].points) return pending('tied-leaders');
  return { winner: table[0].name, reason: 'winner-estimated', matchesUsed: matches.length };
}

/**
 * Recognise only explicit semifinal round names in the imported source;
 * never guess a bracket from the order, fixture count or chronology.
 * The normalized forms cover PT/EN singular/plural and 1/2 final.
 */
export function isSemifinalRound(sourceRound: string | null | undefined): boolean {
  const label = normalize(sourceRound || '').replace(/[-_./]+/g, ' ').replace(/\s+/g, ' ');
  return /^(?:semi\s*fina(?:l|is)|meias?\s*fina(?:l|is)|1\s*2\s*fina(?:l|is))(?:\s*[12ab])?$/.test(label);
}

/** Only source-labelled quarterfinals, including common PT/EN and 1/4 variants. */
export function isQuarterfinalRound(sourceRound: string | null | undefined): boolean {
  const label = normalize(sourceRound || '').replace(/[-_./]+/g, ' ').replace(/\s+/g, ' ');
  return /^(?:(?:quartos?|quartas?)\s*(?:de\s*)?fina(?:l|is)|quarter\s*finals?|1\s*4\s*(?:de\s*)?fina(?:l|is))(?:\s*(?:[1-4]|[a-d]))?$/.test(label);
}

/** Share exactly the final-label recognition used by the winner estimator. */
export function isHistoricalFinalRound(sourceRound: string | null | undefined): boolean {
  return /^(?:grande[- ]?)?final(?:issima)?(?:[- ]?\d{4})?$/.test(normalize(sourceRound || ''));
}

function normalize(value: string): string {
  return value.trim().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-PT').replace(/\s+/g, ' ');
}
