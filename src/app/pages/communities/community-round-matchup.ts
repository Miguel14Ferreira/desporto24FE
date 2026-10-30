import { CommunityMatchResult, CommunityRound, CommunityRoundEntry } from '../model/community-group';

export interface CommunityRoundSide {
  label: string;
  entries: CommunityRoundEntry[];
  result: CommunityMatchResult | null;
}

export interface CommunityRoundMatchup {
  left: CommunityRoundSide;
  right: CommunityRoundSide;
  inferred: boolean;
}

function sharedResult(entries: CommunityRoundEntry[]): CommunityMatchResult | null {
  const results = new Set(entries.map(entry => entry.result));
  return results.size === 1 ? entries[0].result : null;
}

/** Preserve recorded team labels; infer a 2-team match only from balanced W/L groups. */
export function communityRoundMatchup(
  round: Pick<CommunityRound, 'entries'>,
  inferredTeamA: string,
  inferredTeamB: string
): CommunityRoundMatchup | null {
  const entries = round.entries || [];
  if (entries.length < 4) return null;
  const names = Array.from(new Set(entries.map(e => e.team?.trim()).filter((x): x is string => !!x)));
  if (names.length === 2 && entries.every(e => e.team?.trim())) {
    const sides = names.map(label => {
      const members = entries.filter(e => e.team?.trim() === label);
      return { label, entries: members, result: sharedResult(members) };
    });
    // Put the winning team first if there is a clear winner; never infer scores.
    if (sides[1].result === 'WIN' && sides[0].result !== 'WIN') sides.reverse();
    return { left: sides[0], right: sides[1], inferred: false };
  }
  if (names.length !== 0) return null; // Partial/mixed team data: use the original list.
  const wins = entries.filter(e => e.result === 'WIN');
  const losses = entries.filter(e => e.result === 'LOSS');
  if (wins.length < 2 || wins.length !== losses.length || wins.length + losses.length !== entries.length) {
    return null;
  }
  return {
    left: { label: inferredTeamA, entries: wins, result: 'WIN' },
    right: { label: inferredTeamB, entries: losses, result: 'LOSS' },
    inferred: true
  };
}
