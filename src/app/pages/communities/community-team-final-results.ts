import { CommunityRound, CommunityTeamFinalScore } from '../model/community-group';

export function isTeamFinalEvent(type: string | null | undefined): boolean {
  return type === 'HANDBALL_FINAL' || type === 'RUGBY_FINAL' || type === 'RUGBY_SEVENS_FINAL'
    || type === 'FUTSAL_FINAL' || type === 'FIELD_HOCKEY_FINAL'
    || type === 'ROLLER_HOCKEY_FINAL' || type === 'WATER_POLO_FINAL'
    || type === 'ICE_HOCKEY_REG' || type === 'ICE_HOCKEY_OT' || type === 'ICE_HOCKEY_SO'
    || type === 'BASEBALL_RUNS' || type === 'SOFTBALL_RUNS'
    || type === 'KORFBALL_REG' || type === 'KORFBALL_GOLDEN'
    || type === 'LACROSSE_M_REG' || type === 'LACROSSE_M_OT';
}
/** Sport-aware scoreboard units: goals, rugby points, or baseball/softball runs. */
export function teamFinalUsesRuns(type: string | null | undefined): boolean {
  return type === 'BASEBALL_RUNS' || type === 'SOFTBALL_RUNS';
}
export function teamFinalUsesGoals(type: string | null | undefined): boolean {
  return isTeamFinalEvent(type) && type !== 'RUGBY_FINAL' && type !== 'RUGBY_SEVENS_FINAL'
    && !teamFinalUsesRuns(type);
}
export function teamFinalScoreLabelKey(type: string | null | undefined): string {
  return teamFinalUsesRuns(type) ? 'communities.teamFinal.runs'
    : teamFinalUsesGoals(type) ? 'communities.teamFinal.goals'
    : 'communities.teamFinal.points';
}

const TEAM_FINAL_LABELS: Record<string, string> = {
  HANDBALL_FINAL: 'handball', RUGBY_FINAL: 'rugby', RUGBY_SEVENS_FINAL: 'sevens',
  FUTSAL_FINAL: 'futsal', FIELD_HOCKEY_FINAL: 'fieldHockey',
  ROLLER_HOCKEY_FINAL: 'rollerHockey', WATER_POLO_FINAL: 'waterPolo',
  ICE_HOCKEY_REG: 'iceRegulation', ICE_HOCKEY_OT: 'iceOvertime', ICE_HOCKEY_SO: 'iceShootout',
  BASEBALL_RUNS: 'baseballRuns', SOFTBALL_RUNS: 'softballRuns',
  KORFBALL_REG: 'korfballReg', KORFBALL_GOLDEN: 'korfballGolden',
  LACROSSE_M_REG: 'lacrosseMenReg', LACROSSE_M_OT: 'lacrosseMenOt'
};
export function teamFinalTitleKey(type: string | null | undefined): string {
  return 'communities.teamFinal.' + (type ? TEAM_FINAL_LABELS[type] ?? 'finalTitle' : 'finalTitle');
}

export function iceHockeyEvent(type: string | null | undefined): boolean {
  return type === 'ICE_HOCKEY_REG' || type === 'ICE_HOCKEY_OT' || type === 'ICE_HOCKEY_SO';
}
export function teamFinalHintKey(type: string | null | undefined): string {
  switch (type) {
    case 'ICE_HOCKEY_REG': return 'communities.iceHockey.regulationHint';
    case 'ICE_HOCKEY_OT': return 'communities.iceHockey.overtimeHint';
    case 'ICE_HOCKEY_SO': return 'communities.iceHockey.shootoutHint';
    case 'BASEBALL_RUNS': return 'communities.teamFinal.baseballRunsHint';
    case 'SOFTBALL_RUNS': return 'communities.teamFinal.softballRunsHint';
    case 'KORFBALL_REG': return 'communities.teamFinal.korfballRegHint';
    case 'KORFBALL_GOLDEN': return 'communities.teamFinal.korfballGoldenHint';
    case 'LACROSSE_M_REG': return 'communities.teamFinal.lacrosseMenRegHint';
    case 'LACROSSE_M_OT': return 'communities.teamFinal.lacrosseMenOtHint';
    default: return teamFinalUsesGoals(type)
      ? 'communities.teamFinal.goalHint' : 'communities.teamFinal.finalHint';
  }
}

export function teamFinalIsDecisiveGoalEvent(type: string | null | undefined): boolean {
  return type === 'ICE_HOCKEY_OT' || type === 'ICE_HOCKEY_SO'
    || type === 'KORFBALL_GOLDEN' || type === 'LACROSSE_M_OT';
}

export function teamFinalError(type: string | null | undefined,
  entries: readonly {team: string; performanceValue?: number | null}[],
  score: CommunityTeamFinalScore | null): string | null {
  if (!isTeamFinalEvent(type)) return score ? 'teamFinalInvalidScore' : null;
  if (!score || score.sideA == null || score.sideB == null
      || !Number.isInteger(score.sideA) || !Number.isInteger(score.sideB)
      || score.sideA < 0 || score.sideB < 0 || score.sideA > 999 || score.sideB > 999)
    return 'teamFinalInvalidScore';
  if (teamFinalIsDecisiveGoalEvent(type)
      && Math.abs(score.sideA - score.sideB) !== 1)
    return (type === 'ICE_HOCKEY_OT' || type === 'ICE_HOCKEY_SO')
      ? 'iceHockeyInvalidDecision' : 'teamFinalDecisiveGoalRequired';
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
