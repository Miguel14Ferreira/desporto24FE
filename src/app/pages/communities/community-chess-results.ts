import { CommunityMatchResult, CommunityRoundEntryDraft } from '../model/community-group';

/** A played game is a single White vs Black encounter, not a generic team result. */
export function chessGameError(entries: readonly Pick<CommunityRoundEntryDraft, 'team' | 'result'>[]): boolean {
  if (entries.length !== 2) return true;
  const white = entries.find(entry => entry.team === 'WHITE');
  const black = entries.find(entry => entry.team === 'BLACK');
  if (!white || !black) return true;
  return !(
    (white.result === 'WIN' && black.result === 'LOSS') ||
    (white.result === 'LOSS' && black.result === 'WIN') ||
    (white.result === 'DRAW' && black.result === 'DRAW')
  );
}

/** FIDE's normal played-game points, without attempting event tie-breaks. */
export function chessGameScore(outcome: CommunityMatchResult): string {
  return outcome === 'WIN' ? '1' : outcome === 'DRAW' ? '½' : '0';
}
