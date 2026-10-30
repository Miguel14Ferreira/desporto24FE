import { CommunityBasketballScore, CommunityRound } from '../model/community-group';

/** Only organizer-recorded FINAL team points; no basket conversion or season formula. */
export function isBasketballFinal(type: string | null | undefined): boolean {
  return type === 'BASKETBALL_FINAL' || type === 'BASKETBALL_3X3_FINAL';
}
export function basketballScoreError(type: string | null | undefined,
  entries: readonly Pick<{ team: string; performanceValue?: number | null }, 'team' | 'performanceValue'>[],
  score: CommunityBasketballScore | null): string | null {
  if (!isBasketballFinal(type)) return score ? 'basketballInvalidScore' : null;
  if (!score || score.sideA == null || score.sideB == null
      || !Number.isInteger(score.sideA) || !Number.isInteger(score.sideB)
      || score.sideA < 0 || score.sideB < 0 || score.sideA > 999 || score.sideB > 999
      || score.sideA === score.sideB) return 'basketballInvalidScore';
  if (!entries.some(e => e.team === 'A') || !entries.some(e => e.team === 'B')
      || entries.some(e => (e.team !== 'A' && e.team !== 'B')
        || e.performanceValue != null)) return 'basketballInvalidTeams';
  return null;
}
export function recordedBasketballFinal(round: Pick<CommunityRound,'eventType' | 'basketballScore'>): boolean {
  return isBasketballFinal(round.eventType) && round.basketballScore?.sideA != null
    && round.basketballScore?.sideB != null;
}
export function basketballWinner(score: CommunityBasketballScore | null | undefined): 'A' | 'B' | null {
  return score?.sideA == null || score.sideB == null || score.sideA === score.sideB ? null
    : score.sideA > score.sideB ? 'A' : 'B';
}
