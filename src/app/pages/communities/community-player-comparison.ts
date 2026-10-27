import { CommunityStanding } from '../model/community-group';

/**
 * Comparison selections represent a row in the currently selected community season,
 * NOT a Jynlo account. Historical Excel players have no username or profile.
 * Generate keys from the visible rows so duplicate names never collide.
 */
export function communityComparisonKey(index: number): string {
  return 'standing:' + index;
}

export function communityComparisonRows(rows: readonly CommunityStanding[]): CommunityStanding[] {
  // Exactly the same set presented in the Statistics tab.
  return rows.filter(row => row.games > 0);
}

export function communityComparisonLookup(rows: readonly CommunityStanding[]): Map<string, CommunityStanding> {
  return new Map(communityComparisonRows(rows)
    .map((row, index) => [communityComparisonKey(index), row] as const));
}
