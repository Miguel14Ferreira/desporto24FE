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
  it('never offers a heat after the official permanent event interruption', () => {
    const ongoing = bracket([match('Q1','SPRINT_QUARTER_FINAL','READY')]);
    ongoing.format = 'OLYMPIC_TWENTY_FOUR_REPECHAGE';
    ongoing.interruption = {
      stage: 'BEFORE_QUARTERS', reference: 'Fictional signed report #20',
      reason: 'Fictional permanent venue closure', recordedBy: 'qa',
      recordedAt: '2026-10-25T18:00:00Z',
      noFinalClassification: true, regulatoryPlacings: []
    };
    expect(availableSprintBracketSlots([ongoing],'SPRINT_QUARTER_FINAL')).toEqual([]);
    ongoing.interruption = null;
    expect(availableSprintBracketSlots([ongoing],'SPRINT_QUARTER_FINAL')
      .map(m=>m.slot)).toEqual(['Q1']);
  });

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
  it('excludes only the series with an unresolved incident, keeping official history', () => {
    const one = bracket([
      match('Q1','SPRINT_QUARTER_FINAL','READY'),
      match('Q2','SPRINT_QUARTER_FINAL','READY')
    ]);
    one.incidents = [{
      id: 13, seriesKey: 'SP41-Q1', heatNumber: 1,
      incidentType: 'PUNCTURE', details: 'Synthetic stopped race',
      status: 'PENDING', reportedBy: 'qa', reportedAt: '2026-10-25T16:00:00Z',
      decisionType: null, decisionReference: null, decisionReason: null,
      decidedBy: null, decidedAt: null
    }];
    expect(availableSprintBracketSlots([one],'SPRINT_QUARTER_FINAL')
      .map(m => m.slot)).toEqual(['Q2']);
    one.incidents[0].status = 'ADJUDICATION_REQUIRED';
    one.incidents[0].decisionType = 'DISCIPLINARY_RULING';
    one.incidents[0].sanctionType = 'DISQUALIFICATION';
    one.incidents[0].sanctionedUsername = 'fixture_rider_01';
    expect(availableSprintBracketSlots([one],'SPRINT_QUARTER_FINAL')
      .map(m => m.slot)).toEqual(['Q2']);
    one.incidents[0].status = 'RESTART_AUTHORIZED';
    one.incidents[0].rerunRiders = ['fixture_rider_02','fixture_rider_03'];
    expect(availableSprintBracketSlots([one],'SPRINT_QUARTER_FINAL')
      .map(m => m.slot)).toEqual(['Q1','Q2']);
    one.incidents[0].status = 'DECIDED';
    one.incidents[0].decisionType = 'RESTART_REQUIRED';
    expect(availableSprintBracketSlots([one],'SPRINT_QUARTER_FINAL')
      .map(m => m.slot)).toEqual(['Q1','Q2']);
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
