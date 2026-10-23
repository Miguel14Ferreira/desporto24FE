import { CommunityRound, CommunitySetScore } from '../model/community-group';

export function isVolleyballEvent(eventType: string | null | undefined): boolean {
  return eventType === 'VOLLEYBALL_FINAL' || eventType === 'BEACH_VOLLEY_FINAL';
}
export function volleyballMaxSets(eventType: string | null | undefined): number {
  return eventType === 'BEACH_VOLLEY_FINAL' ? 3 : 5;
}
export function volleyballMinSets(eventType: string | null | undefined): number {
  return eventType === 'BEACH_VOLLEY_FINAL' ? 2 : 3;
}

/** Validates one complete FIVB-style match, excluding forfeits and shortened variants. */
export function volleyballMatchError(
  eventType: string | null | undefined,
  entries: readonly {team: string; performanceValue?: number | null}[],
  sets: readonly CommunitySetScore[]
): string | null {
  if (!isVolleyballEvent(eventType)) return sets.length ? 'volleyballInvalidScore' : null;
  const required = volleyballMinSets(eventType);
  const maximum = volleyballMaxSets(eventType);
  if (sets.length < required || sets.length > maximum) return 'volleyballInvalidSets';
  let a = 0, b = 0;
  for (let i = 0; i < sets.length; i++) {
    const x = sets[i].sideA, y = sets[i].sideB;
    if (x == null || y == null || !Number.isInteger(x) || !Number.isInteger(y)
        || x < 0 || y < 0 || x > 999 || y > 999) return 'volleyballInvalidScore';
    const target = i === maximum - 1 ? 15 : maximum === 3 ? 21 : 25;
    const high = Math.max(x, y), low = Math.min(x, y);
    if (high < target || high - low < 2 ||
        (low < target - 1 && high !== target) ||
        (low >= target - 1 && high !== low + 2))
      return 'volleyballInvalidScore';
    if (x > y) a++; else b++;
    if ((a === required || b === required) && i !== sets.length - 1)
      return 'volleyballInvalidSets';
  }
  if (a !== required && b !== required) return 'volleyballInvalidSets';
  const countA = entries.filter(p => p.team === 'A').length;
  const countB = entries.filter(p => p.team === 'B').length;
  if (entries.some(p => (p.team !== 'A' && p.team !== 'B') || p.performanceValue != null)
      || (eventType === 'BEACH_VOLLEY_FINAL'
        ? countA !== 2 || countB !== 2 : countA < 1 || countB < 1))
    return 'volleyballInvalidTeams';
  return null;
}

export function volleyballSetWinner(
  sets: readonly CommunitySetScore[] | null | undefined
): 'A' | 'B' | null {
  if (!sets?.length) return null;
  let a = 0, b = 0;
  for (const set of sets) {
    if (set.sideA == null || set.sideB == null || set.sideA === set.sideB) return null;
    if (set.sideA > set.sideB) a++; else b++;
  }
  return a === b ? null : a > b ? 'A' : 'B';
}
export function volleyballSetTotals(sets: readonly CommunitySetScore[] | null | undefined):
  {sideA: number; sideB: number} {
  return (sets ?? []).reduce<{sideA: number; sideB: number}>((total, set) => ({
    sideA: total.sideA + Number((set.sideA ?? -1) > (set.sideB ?? -1)),
    sideB: total.sideB + Number((set.sideB ?? -1) > (set.sideA ?? -1))
  }), {sideA: 0, sideB: 0});
}
export function recordedVolleyballMatch(round: Pick<CommunityRound, 'eventType'|'setScores'>): boolean {
  return isVolleyballEvent(round.eventType) && !!round.setScores?.length;
}
