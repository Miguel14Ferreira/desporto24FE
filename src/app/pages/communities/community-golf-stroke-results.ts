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
      || seen.has(round.participantId)
      || !Array.isArray(round.strokesByHole)
      || round.strokesByHole.length !== holeCount
      || !round.strokesByHole.every(strokes => Number.isSafeInteger(strokes) && strokes > 0)) {
      return null;
    }
    seen.add(round.participantId);
    const totalStrokes = round.strokesByHole.reduce((total, strokes) => total + strokes, 0);
    if (!Number.isSafeInteger(totalStrokes)) return null;
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
