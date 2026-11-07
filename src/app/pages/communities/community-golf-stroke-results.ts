/** Gross stroke-play totals. No handicap, Stableford or federation tie-break rules. */
export type GolfStrokeRound = Readonly<{
  participantId: number;
  strokesByHole: readonly number[];
}>;

export type GolfStrokeStanding = Readonly<{
  participantId: number;
  totalStrokes: number;
  rank: number;
}>;

/**
 * Converts a complete hole-by-hole card into the gross total accepted by the
 * existing community round API. This does not create a tournament or infer a
 * handicap, a match outcome, or a tie-break.
 */
export function golfGrossTotal(
  holeCount: 9 | 18,
  strokesByHole: readonly number[]
): number | null {
  if ((holeCount !== 9 && holeCount !== 18)
    || !Array.isArray(strokesByHole)
    || strokesByHole.length !== holeCount
    || !strokesByHole.every(strokes => Number.isSafeInteger(strokes) && strokes > 0)) {
    return null;
  }
  const total = strokesByHole.reduce((sum, strokes) => sum + strokes, 0);
  // The backend currently accepts integer totals from holeCount to 999999.
  return Number.isSafeInteger(total) && total <= 999999 ? total : null;
}

/**
 * Returns null for an incomplete or malformed leaderboard. Equal totals share
 * the same competition rank; no unverified countback rule is applied.
 */
export function golfStrokeStandings(
  holeCount: 9 | 18,
  rounds: readonly GolfStrokeRound[]
): GolfStrokeStanding[] | null {
  if (holeCount !== 9 && holeCount !== 18) return null;
  if (!Array.isArray(rounds) || !rounds.length) return null;
  const seen = new Set<number>();
  const totals: Array<{ participantId: number; totalStrokes: number }> = [];
  for (const round of rounds) {
    if (!round || typeof round !== 'object' || !Number.isSafeInteger(round.participantId) || round.participantId <= 0
      || seen.has(round.participantId)) {
      return null;
    }
    seen.add(round.participantId);
    const totalStrokes = golfGrossTotal(holeCount, round.strokesByHole);
    if (totalStrokes === null) return null;
    totals.push({ participantId: round.participantId, totalStrokes });
  }
  totals.sort((a, b) => a.totalStrokes - b.totalStrokes || a.participantId - b.participantId);
  // Competition ranking (1, 1, 3), in one pass after sorting.
  let rank = 0;
  return totals.map((entry, index) => {
    if (index === 0 || entry.totalStrokes !== totals[index - 1].totalStrokes) {
      rank = index + 1;
    }
    return { ...entry, rank };
  });
}
