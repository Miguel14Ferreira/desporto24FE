import { CommunityRoundEntryDraft } from '../model/community-group';

/** A completed individual IJF-style bout has White/Blue and exactly one winner. */
export function isJudoBout(type: string | null | undefined): boolean {
  return type === 'JUDO_IPPON' || type === 'JUDO_AWASETE_IPPON'
    || type === 'JUDO_WAZA_ARI' || type === 'JUDO_YUKO'
    || type === 'JUDO_HANSOKU_MAKE';
}

export function judoBoutError(
  entries: readonly Pick<CommunityRoundEntryDraft, 'team' | 'result'>[]
): boolean {
  if (entries.length !== 2) return true;
  const white = entries.find(e => e.team === 'WHITE');
  const blue = entries.find(e => e.team === 'BLUE');
  if (!white || !blue) return true;
  return !((white.result === 'WIN' && blue.result === 'LOSS')
    || (white.result === 'LOSS' && blue.result === 'WIN'));
}
