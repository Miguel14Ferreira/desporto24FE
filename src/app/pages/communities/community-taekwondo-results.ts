import { CommunityRoundEntryDraft } from '../model/community-group';

/** Final results only. No automatic WT refereeing, handicap, judge sheets or season rankings. */
export function isTaekwondoKyorugi(type: string | null | undefined): boolean {
  return type === 'TKD_KYORUGI_BEST3';
}
export function isTaekwondoPoomsae(type: string | null | undefined): boolean {
  return type === 'TKD_POOMSAE_RECOGNIZED' || type === 'TKD_POOMSAE_FREESTYLE';
}
export function isTaekwondoEvent(type: string | null | undefined): boolean {
  return isTaekwondoKyorugi(type) || isTaekwondoPoomsae(type);
}
export function taekwondoResultError(
  type: string | null | undefined,
  entries: readonly Pick<CommunityRoundEntryDraft, 'username' | 'team' | 'result' | 'performanceValue'>[]
): boolean {
  if (!isTaekwondoEvent(type) || !entries.length) return true;
  if (isTaekwondoKyorugi(type)) {
    if (entries.length !== 2) return true;
    const blue = entries.find(e => e.team === 'CHUNG');
    const red = entries.find(e => e.team === 'HONG');
    if (!blue || !red || !((blue.result === 'WIN' && red.result === 'LOSS')
      || (blue.result === 'LOSS' && red.result === 'WIN'))) return true;
    return entries.some(e => {
      const value = e.performanceValue;
      return value == null || !Number.isInteger(Number(value))
        || (e.result === 'WIN' ? Number(value) !== 2
          : Number(value) !== 0 && Number(value) !== 1);
    });
  }
  if (new Set(entries.map(e => e.username)).size !== entries.length) return true;
  return entries.some(e => {
    const value = e.performanceValue;
    return e.result !== 'DRAW' || !!e.team?.trim()
      || value == null || !Number.isFinite(Number(value))
      || Number(value) < 0 || Number(value) > 10
      || Math.abs(Number(value) * 1000 - Math.round(Number(value) * 1000)) > 1e-6;
  });
}
