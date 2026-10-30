import { CommunityRound } from '../model/community-group';

/** Display only plausible recorded flying-200m rounds as source candidates.
 * The backend is the authority for verified seeds and permission checks.
 */
export function availableSprintQualifiers(
  rounds: readonly CommunityRound[], requiredRiders: 16 | 24 | 28 = 16
): CommunityRound[] {
  return rounds.filter(round => {
    if (round.sport !== 'Ciclismo de Pista' ||
        round.eventType !== 'TRACK_FLYING_200') return false;
    const entries = round.entries || [];
    const identifiers = entries.map(entry => (entry.username || '').trim().toLowerCase());
    if (identifiers.some(name => !name || identifiers.filter(x=>x===name).length>1))
      return false;
    const timed = entries.filter(entry => !entry.raceDisqualified &&
      entry.elapsedSeconds != null && Number.isFinite(entry.elapsedSeconds) &&
      entry.elapsedSeconds > 0).map(entry => entry.elapsedSeconds!)
      .sort((a,b)=>a-b);
    if (timed.length < requiredRiders) return false;
    // An official 100m split or witnessed lot may resolve a 200m dead heat.
    // Let organizers select the source; the separate form and backend require
    // explicit evidence before any tied seed is ever assigned.
    return true;
  });
}

export function nextSprintRoundHeatMax(
  phase: string | null | undefined
): number {
  return phase === 'SPRINT_PLACES_5_8' ? 1
    : phase === 'SPRINT_EIGHTH_FINAL' || phase === 'SPRINT_SIXTEENTH_FINAL'
    || phase === 'SPRINT_THIRTY_SECOND_FINAL' || phase?.startsWith('SPRINT_REPECHAGE_')
      ? 1 : 3;
}
