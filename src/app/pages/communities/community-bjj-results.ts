import { CommunityRoundEntryDraft } from '../model/community-group';

/** Individual Gi IBJJF-style final result. No advantages, penalties or official tie-break inferred. */
export function isBjjPoints(type: string | null | undefined): boolean {
  return type === 'BJJ_IBJJF_GI_POINTS';
}
export function isBjjEvent(type: string | null | undefined): boolean {
  return type === 'BJJ_IBJJF_GI_SUBMISSION' || isBjjPoints(type);
}
export function bjjResultError(
  type: string | null | undefined,
  entries: readonly Pick<CommunityRoundEntryDraft, 'username' | 'team' | 'result' | 'performanceValue'>[]
): boolean {
  if (!isBjjEvent(type) || entries.length !== 2) return true;
  const a = entries.find(e => e.team === 'A'), b = entries.find(e => e.team === 'B');
  if (!a || !b || a.username.trim().toLowerCase() === b.username.trim().toLowerCase()
    || !((a.result === 'WIN' && b.result === 'LOSS') || (a.result === 'LOSS' && b.result === 'WIN'))) return true;
  if (!isBjjPoints(type)) return entries.some(e => e.performanceValue != null);
  const av = a.performanceValue, bv = b.performanceValue;
  if (av == null || bv == null || !Number.isInteger(Number(av)) || !Number.isInteger(Number(bv))
    || Number(av) < 0 || Number(bv) < 0 || Number(av) > 999999 || Number(bv) > 999999
    || Number(av) === 1 || Number(bv) === 1 || Number(av) === Number(bv)) return true;
  return Number(av) > Number(bv) ? a.result !== 'WIN' : b.result !== 'WIN';
}
