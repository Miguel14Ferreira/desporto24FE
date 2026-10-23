import { CommunityRound, CommunityTeamFinalScore } from '../model/community-group';

export function isTeamFinalEvent(type: string | null | undefined): boolean {
  return type === 'HANDBALL_FINAL' || type === 'RUGBY_FINAL' || type === 'RUGBY_SEVENS_FINAL';
}
export function teamFinalError(type: string | null | undefined,
  entries: readonly {team: string; performanceValue?: number | null}[],
  score: CommunityTeamFinalScore | null): string | null {
  if (!isTeamFinalEvent(type)) return score ? 'teamFinalInvalidScore' : null;
  if (!score || score.sideA == null || score.sideB == null
      || !Number.isInteger(score.sideA) || !Number.isInteger(score.sideB)
      || score.sideA < 0 || score.sideB < 0 || score.sideA > 999 || score.sideB > 999)
    return 'teamFinalInvalidScore';
  if (!entries.some(e => e.team === 'A') || !entries.some(e => e.team === 'B')
      || entries.some(e => (e.team !== 'A' && e.team !== 'B') || e.performanceValue != null))
    return 'teamFinalInvalidTeams';
  return null;
}
export function recordedTeamFinal(round: Pick<CommunityRound,'eventType'|'teamScore'>): boolean {
  return isTeamFinalEvent(round.eventType) && round.teamScore?.sideA != null
    && round.teamScore?.sideB != null;
}
export function teamFinalWinner(score: CommunityTeamFinalScore | null | undefined): 'A'|'B'|null {
  return score?.sideA == null || score.sideB == null || score.sideA === score.sideB
    ? null : score.sideA > score.sideB ? 'A' : 'B';
}
