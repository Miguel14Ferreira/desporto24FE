import { CommunityRoundEntryDraft } from '../model/community-group';

/**
 * Six distinct WAKO individual disciplines, never generic boxing.
 * PF shows organizer-confirmed final integer points; other five styles
 * store a confirmed winner without synthesizing judges' round scorecards.
 */
export function isKickboxingEvent(type: string | null | undefined): boolean {
  return type === 'WAKO_POINT_FIGHTING' || type === 'WAKO_LIGHT_CONTACT'
    || type === 'WAKO_KICK_LIGHT' || type === 'WAKO_FULL_CONTACT'
    || type === 'WAKO_LOW_KICK' || type === 'WAKO_K1';
}

export function isKickboxingPointFighting(type: string | null | undefined): boolean {
  return type === 'WAKO_POINT_FIGHTING';
}

export function kickboxingResultError(
  type: string | null | undefined,
  entries: readonly Pick<CommunityRoundEntryDraft, 'username' | 'team' | 'result'
    | 'performanceValue' | 'waveScore1' | 'waveScore2'>[]
): boolean {
  if (!isKickboxingEvent(type) || entries.length !== 2) return true;
  const red = entries.find(e => e.team === 'RED');
  const blue = entries.find(e => e.team === 'BLUE');
  if (!red || !blue || !red.username.trim() || !blue.username.trim()
    || red.username.trim().toLowerCase() === blue.username.trim().toLowerCase()
    || !((red.result === 'WIN' && blue.result === 'LOSS')
      || (red.result === 'LOSS' && blue.result === 'WIN'))) return true;
  if (entries.some(e => e.waveScore1 != null || e.waveScore2 != null)) return true;
  if (!isKickboxingPointFighting(type)) return entries.some(e => e.performanceValue != null);
  const a = red.performanceValue, b = blue.performanceValue;
  if (a == null || b == null || !Number.isInteger(Number(a)) || !Number.isInteger(Number(b))
    || Number(a) < 0 || Number(b) < 0 || Number(a) > 999999 || Number(b) > 999999
    || Number(a) === Number(b)) return true;
  return Number(a) > Number(b) ? red.result !== 'WIN' : blue.result !== 'WIN';
}
