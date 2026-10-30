import { CommunityRoundEntryDraft } from '../model/community-group';

/** Individual IFMA full-contact results recorded after the official bout decision. */
export function isMuayThaiEvent(type: string | null | undefined): boolean {
  return type === 'IFMA_FULL_WP' || type === 'IFMA_FULL_KO'
    || type === 'IFMA_FULL_RSCS' || type === 'IFMA_FULL_RSCI';
}

export function muayThaiResultError(
  type: string | null | undefined,
  entries: readonly Pick<CommunityRoundEntryDraft, 'username' | 'team' | 'result'
    | 'performanceValue' | 'waveScore1' | 'waveScore2'>[]
): boolean {
  if (!isMuayThaiEvent(type) || entries.length !== 2) return true;
  const red = entries.find(e => e.team === 'RED');
  const blue = entries.find(e => e.team === 'BLUE');
  if (!red || !blue || !red.username.trim() || !blue.username.trim()
    || red.username.trim().toLowerCase() === blue.username.trim().toLowerCase()
    || !((red.result === 'WIN' && blue.result === 'LOSS')
      || (red.result === 'LOSS' && blue.result === 'WIN'))) return true;
  return entries.some(e => e.performanceValue != null
    || e.waveScore1 != null || e.waveScore2 != null);
}
