import { CommunityRoundEntryDraft } from '../model/community-group';

/**
 * World Boxing-style confirmed WIN/LOSS and outcome only.
 * No inferred judge cards, summed round points, draw, or official season ranking.
 */
export function isBoxingEvent(type: string | null | undefined): boolean {
  return type === 'BOXING_WB_POINTS' || type === 'BOXING_WB_KO'
    || type === 'BOXING_WB_RSC';
}

export function boxingResultError(
  type: string | null | undefined,
  entries: readonly Pick<CommunityRoundEntryDraft, 'username' | 'team' | 'result'
    | 'performanceValue' | 'waveScore1' | 'waveScore2'>[]
): boolean {
  if (!isBoxingEvent(type) || entries.length !== 2) return true;
  const red = entries.find(e => e.team === 'RED');
  const blue = entries.find(e => e.team === 'BLUE');
  if (!red || !blue || !red.username.trim() || !blue.username.trim()
      || red.username.trim().toLowerCase() === blue.username.trim().toLowerCase()
      || !((red.result === 'WIN' && blue.result === 'LOSS')
        || (red.result === 'LOSS' && blue.result === 'WIN'))) return true;
  return entries.some(e => e.performanceValue != null
    || e.waveScore1 != null || e.waveScore2 != null);
}
