import { CommunityRoundEntryDraft } from '../model/community-group';

/** Organizer records the already-awarded verdict; no invented judge vote totals. */
export function breakingBattleError(
  entrants: readonly Pick<CommunityRoundEntryDraft, 'result'>[]
): boolean {
  return entrants.length !== 2
    || entrants.filter(e => e.result === 'WIN').length !== 1
    || entrants.filter(e => e.result === 'LOSS').length !== 1;
}
