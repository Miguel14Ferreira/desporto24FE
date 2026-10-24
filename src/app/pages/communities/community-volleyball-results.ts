import { CommunityRound, CommunitySetScore } from '../model/community-group';

export function isVolleyballEvent(eventType: string | null | undefined): boolean {
  return eventType === 'VOLLEYBALL_FINAL' || eventType === 'BEACH_VOLLEY_FINAL'
    || eventType === 'FOOTVOLLEY_SINGLE_18' || eventType === 'FOOTVOLLEY_BEST_OF_3'
    || eventType === 'FOOTVOLLEY_SINGLE_15'
    || eventType === 'TEQBALL_SINGLES' || eventType === 'TEQBALL_DOUBLES';
}
export function isTeqballEvent(eventType: string | null | undefined): boolean {
  return eventType === 'TEQBALL_SINGLES' || eventType === 'TEQBALL_DOUBLES';
}
export function volleyballSideLabelKey(type: string | null | undefined, side: 'A'|'B'): string {
  return type === 'TEQBALL_SINGLES' ? 'communities.teamFinal.player' + side
    : 'communities.volleyball.side' + side;
}
export function volleyballMemberSelectorKey(type: string | null | undefined): string {
  return type === 'TEQBALL_SINGLES' ? 'communities.teqball.player'
    : 'communities.volleyball.side';
}
export function isFootvolleyEvent(eventType: string | null | undefined): boolean {
  return eventType === 'FOOTVOLLEY_SINGLE_18' || eventType === 'FOOTVOLLEY_BEST_OF_3'
    || eventType === 'FOOTVOLLEY_SINGLE_15';
}
export function volleyballMaxSets(eventType: string | null | undefined): number {
  if (eventType === 'FOOTVOLLEY_SINGLE_18' || eventType === 'FOOTVOLLEY_SINGLE_15') return 1;
  return isTeqballEvent(eventType) || eventType === 'BEACH_VOLLEY_FINAL'
    || eventType === 'FOOTVOLLEY_BEST_OF_3' ? 3 : 5;
}
export function volleyballMinSets(eventType: string | null | undefined): number {
  if (eventType === 'FOOTVOLLEY_SINGLE_18' || eventType === 'FOOTVOLLEY_SINGLE_15') return 1;
  return isTeqballEvent(eventType) || eventType === 'BEACH_VOLLEY_FINAL'
    || eventType === 'FOOTVOLLEY_BEST_OF_3' ? 2 : 3;
}
export function volleyballFormatHint(eventType: string | null | undefined): string {
  switch (eventType) {
    case 'FOOTVOLLEY_SINGLE_18': return 'communities.footvolley.single18Hint';
    case 'FOOTVOLLEY_BEST_OF_3': return 'communities.footvolley.bestOf3Hint';
    case 'FOOTVOLLEY_SINGLE_15': return 'communities.footvolley.single15Hint';
    case 'BEACH_VOLLEY_FINAL': return 'communities.volleyball.beachHint';
    case 'TEQBALL_SINGLES': return 'communities.teqball.singlesHint';
    case 'TEQBALL_DOUBLES': return 'communities.teqball.doublesHint';
    default: return 'communities.volleyball.indoorHint';
  }
}
export function volleyballResultTitle(eventType: string | null | undefined): string {
  return isTeqballEvent(eventType) ? 'communities.teqball.title'
    : isFootvolleyEvent(eventType) ? 'communities.footvolley.title'
    : 'communities.volleyball.setsTitle';
}

/** Validates one complete match according to its selected sport format, not a shared rulebook. */
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
    const teqball = isTeqballEvent(eventType);
    const target = teqball ? 12 : eventType === 'FOOTVOLLEY_SINGLE_15' ? 15
      : isFootvolleyEvent(eventType) ? i === 2 ? 15 : 18
      : i === maximum - 1 ? 15 : maximum === 3 ? 21 : 25;
    const high = Math.max(x, y), low = Math.min(x, y);
    if (teqball && i < 2 ? high !== 12 || low >= 12
        : high < target || high - low < 2 ||
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
      || (eventType === 'TEQBALL_SINGLES' ? countA !== 1 || countB !== 1
        : eventType === 'TEQBALL_DOUBLES' ? countA !== 2 || countB !== 2
        : eventType === 'BEACH_VOLLEY_FINAL' || isFootvolleyEvent(eventType)
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
