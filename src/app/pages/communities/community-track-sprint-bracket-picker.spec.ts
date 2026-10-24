import { CommunityRound } from '../model/community-group';
import { TrackSprintBracketMatch, TrackSprintBracketOverview } from '../../services/community-groups.service';
import { availableSprintBracketSlots, nextSprintBracketHeatNumber } from './community-track-sprint-bracket-picker';

function match(slot: string, phase: TrackSprintBracketMatch['phase'],
  status: TrackSprintBracketMatch['status']): TrackSprintBracketMatch {
  return { slot, phase, status, seriesKey: 'SP41-' + slot,
    riderA: null, riderB: null, winsA: 0, winsB: 0, winner: null };
}
function bracket(matches: TrackSprintBracketMatch[]): TrackSprintBracketOverview {
  return { id: 41, seasonId: 4, name: 'Sprint 2026', format: 'EIGHT_RIDER_FINALS', matches };
}
function round(eventType: string, key: string | null, n: number | null): CommunityRound {
  return {id: n || 99, name: 'Manga', playedAt: '2026-10-24T10:00:00Z',
    eventType, sprintSeriesKey: key, sprintHeatNumber: n, entries: []} as CommunityRound;
}

describe('Track Sprint bracket picker', () => {
  it('shows only phase-matched ready/in-progress series', () => {
    const entries = [match('Q1', 'SPRINT_QUARTER_FINAL', 'READY'),
      match('Q2','SPRINT_QUARTER_FINAL','FINISHED'),
      match('Q3','SPRINT_QUARTER_FINAL','CONFLICT'),
      match('S1','SPRINT_SEMI_FINAL','WAITING_PREVIOUS'),
      match('Q4','SPRINT_QUARTER_FINAL','IN_PROGRESS')];
    const result = availableSprintBracketSlots([bracket(entries)], 'SPRINT_QUARTER_FINAL');
    expect(result.map(item=>item.slot)).toEqual(['Q1','Q4']);
    expect(availableSprintBracketSlots([bracket(entries)], 'SPRINT_SEMI_FINAL')).toEqual([]);
    expect(availableSprintBracketSlots([bracket(entries)], '')).toEqual([]);
  });
  it('never infers heat numbers from other events or another series', () => {
    const rounds = [
      round('TRACK_SPRINT_HEAT','SP41-Q1',1),
      round('TRACK_SPRINT_HEAT','SP41-Q1',2),
      round('TRACK_SPRINT_HEAT','SP41-Q2',3),
      round('TRACK_SCRATCH','SP41-Q1',3),
      round('TRACK_SPRINT_HEAT',null,null)
    ];
    expect(nextSprintBracketHeatNumber(rounds,'SP41-Q1')).toBe(3);
    expect(nextSprintBracketHeatNumber(rounds,'SP41-S1')).toBe(1);
    expect(nextSprintBracketHeatNumber(rounds,'')).toBe(1);
  });
});
