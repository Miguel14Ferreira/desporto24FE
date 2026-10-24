import { CommunityRound } from '../model/community-group';
import { availableSprintQualifiers, nextSprintRoundHeatMax } from './community-track-sprint-qualified16';

function qualifier(count: number): CommunityRound {
  return { id: 88, name: 'Flying 200 m', playedAt: '2026-10-25T10:00:00Z',
    sport: 'Ciclismo de Pista', eventType: 'TRACK_FLYING_200',
    entries: Array.from({length: count}, (_, i) => ({
      username: 'r' + (i+1), elapsedSeconds: 10 + i/1000,
      raceDisqualified: false
    })) } as CommunityRound;
}
describe('Track sprint sixteen-rider qualifying', () => {
  it('only presents explicitly timed, unambiguous 200 m rounds', () => {
    expect(availableSprintQualifiers([qualifier(16)]).map(r=>r.id)).toEqual([88]);
    expect(availableSprintQualifiers([qualifier(15)])).toEqual([]);
    const other = {...qualifier(16), eventType: 'TRACK_SCRATCH'} as CommunityRound;
    expect(availableSprintQualifiers([other])).toEqual([]);
  });
  it('does not pick winners from tied timestamps or a disqualified rider', () => {
    const tied=qualifier(17);
    tied.entries[16].elapsedSeconds=tied.entries[15].elapsedSeconds;
    expect(availableSprintQualifiers([tied])).toEqual([]);
    const disqualified=qualifier(16);
    disqualified.entries[15].raceDisqualified=true;
    expect(availableSprintQualifiers([disqualified])).toEqual([]);
  });
  it('allows just one eighth-final heat; later best-of-three remains intact', () => {
    expect(nextSprintRoundHeatMax('SPRINT_EIGHTH_FINAL')).toBe(1);
    expect(nextSprintRoundHeatMax('SPRINT_QUARTER_FINAL')).toBe(3);
    expect(nextSprintRoundHeatMax('SPRINT_GOLD_FINAL')).toBe(3);
  });
});
