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
