import { CommunityRoundEntryDraft } from '../model/community-group';

/** One independently judged two-rider Sprint heat. Not an automatic bracket or best-of-three verdict. */
export function trackSprintHeatError(
  entries: readonly Pick<CommunityRoundEntryDraft, 'result'>[],
  phase?: string | null
): boolean {
  const expected = phase === 'SPRINT_REPECHAGE_1_32' || phase === 'SPRINT_REPECHAGE_1_8' ? 3 : 2;
  return entries.length !== expected
    || entries.filter(entry => entry.result === 'WIN').length !== 1
    || entries.filter(entry => entry.result === 'LOSS').length !== expected-1;
}

/** Olympic classification is an independently recorded four-rider 5th–8th race. */
export function trackSprintPlacesError(
  entries: readonly Pick<CommunityRoundEntryDraft, 'result' | 'finishPosition' | 'username'>[]
): boolean {
  if (entries.length !== 4) return true;
  const participants = entries.map(e => e.username?.trim().toLowerCase());
  const places = entries.map(e => e.finishPosition);
  return participants.some(name => !name) || new Set(participants).size !== 4
    || entries.some(e => e.result !== 'DRAW')
    || new Set(places).size !== 4
    || places.some(p => p == null || p < 5 || p > 8);
}
