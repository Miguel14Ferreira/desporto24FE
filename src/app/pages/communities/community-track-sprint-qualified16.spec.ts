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
  it('presents sufficiently timed 200 m rounds, including sources needing official tie resolution', () => {
    expect(availableSprintQualifiers([qualifier(16)]).map(r=>r.id)).toEqual([88]);
    expect(availableSprintQualifiers([qualifier(15)])).toEqual([]);
    const other = {...qualifier(16), eventType: 'TRACK_SCRATCH'} as CommunityRound;
    expect(availableSprintQualifiers([other])).toEqual([]);
  });
  it('never invents tied winners and excludes a disqualified source below minimum participants', () => {
    const tied=qualifier(17);
    tied.entries[16].elapsedSeconds=tied.entries[15].elapsedSeconds;
    expect(availableSprintQualifiers([tied]).map(r=>r.id)).toEqual([88]);
    // A tied source remains selectable only for the explicit witness form;
    // the server must not create a bracket until that form is valid.
    const disqualified=qualifier(16);
    disqualified.entries[15].raceDisqualified=true;
    expect(availableSprintQualifiers([disqualified])).toEqual([]);
  });
  it('requires 28 recorded and unambiguous 200m times in the world-cup format', () => {
    expect(availableSprintQualifiers([qualifier(28)], 28).map(r => r.id)).toEqual([88]);
    expect(availableSprintQualifiers([qualifier(27)], 28)).toEqual([]);
    const tied = qualifier(29);
    tied.entries[28].elapsedSeconds = tied.entries[27].elapsedSeconds;
    expect(availableSprintQualifiers([tied], 28).map(r=>r.id)).toEqual([88]);
    expect(availableSprintQualifiers([qualifier(28)], 16).map(r => r.id)).toEqual([88]);
  });
  it('requires exactly 24 unambiguous timings for the Olympic variant', () => {
    expect(availableSprintQualifiers([qualifier(24)], 24).map(r=>r.id)).toEqual([88]);
    expect(availableSprintQualifiers([qualifier(23)], 24)).toEqual([]);
  });
  it('allows just one eighth-final and sixteenth-final heat', () => {
    expect(nextSprintRoundHeatMax('SPRINT_PLACES_5_8')).toBe(1);
    expect(nextSprintRoundHeatMax('SPRINT_THIRTY_SECOND_FINAL')).toBe(1);
    expect(nextSprintRoundHeatMax('SPRINT_REPECHAGE_1_32')).toBe(1);
    expect(nextSprintRoundHeatMax('SPRINT_REPECHAGE_1_16')).toBe(1);
    expect(nextSprintRoundHeatMax('SPRINT_REPECHAGE_1_8')).toBe(1);
    expect(nextSprintRoundHeatMax('SPRINT_SIXTEENTH_FINAL')).toBe(1);
    expect(nextSprintRoundHeatMax('SPRINT_EIGHTH_FINAL')).toBe(1);
    expect(nextSprintRoundHeatMax('SPRINT_QUARTER_FINAL')).toBe(3);
    expect(nextSprintRoundHeatMax('SPRINT_GOLD_FINAL')).toBe(3);
  });
});
