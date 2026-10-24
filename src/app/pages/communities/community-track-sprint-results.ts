import { CommunityRoundEntryDraft } from '../model/community-group';

/** One independently judged two-rider Sprint heat. Not an automatic bracket or best-of-three verdict. */
export function trackSprintHeatError(
  entries: readonly Pick<CommunityRoundEntryDraft, 'result'>[]
): boolean {
  return entries.length !== 2
    || entries.filter(entry => entry.result === 'WIN').length !== 1
    || entries.filter(entry => entry.result === 'LOSS').length !== 1;
}
