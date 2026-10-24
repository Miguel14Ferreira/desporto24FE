import { CommunityCricketDetails, CommunityTeamFinalScore } from '../model/community-group';

/** Only completed, uninterrupted regular T20 innings, not DLS or Super Overs. */
export function cricketT20Error(
  details: CommunityCricketDetails | null,
  score: CommunityTeamFinalScore | null
): boolean {
  if (!details || !score || !Number.isInteger(score.sideA) || !Number.isInteger(score.sideB)
      || score.sideA! < 0 || score.sideB! < 0 || score.sideA! > 999 || score.sideB! > 999) return true;
  for (const [wickets, balls] of [
    [details.wicketsA, details.legalBallsA], [details.wicketsB, details.legalBallsB]
  ]) {
    if (!Number.isInteger(wickets) || !Number.isInteger(balls)
        || wickets! < 0 || wickets! > 10 || balls! < 1 || balls! > 120) return true;
  }
  if (details.wicketsA !== 10 && details.legalBallsA !== 120) return true;
  if (details.wicketsB !== 10 && details.legalBallsB !== 120
      && score.sideB! <= score.sideA!) return true;
  return false;
}

/** 116 legal balls are 19.2 overs (not decimal 19.33). */
export function cricketOvers(legalBalls: number | null): string {
  return legalBalls == null ? '—' : `${Math.floor(legalBalls / 6)}.${legalBalls % 6}`;
}
