import { CommunityRound } from '../model/community-group';
import { TrackSprintBracketMatch, TrackSprintBracketOverview } from '../../services/community-groups.service';

/** Only selectable, phase-compatible organizer-confirmed slots appear. */
export function availableSprintBracketSlots(
  brackets: readonly TrackSprintBracketOverview[], phase: string | null | undefined
): TrackSprintBracketMatch[] {
  if (!phase) return [];
  return brackets.flatMap(b => b.interruption ? [] : b.matches.filter(m => m.phase === phase
    && (m.status === 'READY' || m.status === 'IN_PROGRESS')
    && !(b.incidents || []).some(i => i.seriesKey === m.seriesKey
      && (i.status === 'PENDING' || i.status === 'ADJUDICATION_REQUIRED'))));
}

/** Never fabricate a heat count: use only registered typed rounds in this season. */
export function nextSprintBracketHeatNumber(
  rounds: readonly CommunityRound[], seriesKey: string
): number {
  if (!seriesKey) return 1;
  const heats = rounds.filter(round =>
    (round.eventType === 'TRACK_SPRINT_HEAT' || round.eventType === 'TRACK_SPRINT_REPECHAGE' || round.eventType === 'TRACK_SPRINT_5_8') && round.sprintSeriesKey === seriesKey
    && round.sprintHeatNumber != null).map(round => round.sprintHeatNumber!);
  if (heats.length === 0) return 1;
  return Math.max(...heats) + 1;
}
