import { trackSprintHeatError } from './community-track-sprint-results';

describe('Track cycling Sprint knockout heat', () => {
  const winner = { result: 'WIN' as const };
  const loser = { result: 'LOSS' as const };
  const undecided = { result: 'DRAW' as const };
  it('requires exactly one winner in two- or three-rider repechages', () => {
    expect(trackSprintHeatError([winner,loser,loser],'SPRINT_REPECHAGE_1_32')).toBeFalse();
    expect(trackSprintHeatError([loser,winner,loser],'SPRINT_REPECHAGE_1_8')).toBeFalse();
    expect(trackSprintHeatError([winner,loser],'SPRINT_REPECHAGE_1_16')).toBeFalse();
    expect(trackSprintHeatError([winner,loser],'SPRINT_REPECHAGE_1_32')).toBeTrue();
    expect(trackSprintHeatError([winner,winner,loser],'SPRINT_REPECHAGE_1_8')).toBeTrue();
    expect(trackSprintHeatError([winner,loser,loser],'SPRINT_REPECHAGE_1_16')).toBeTrue();
  });
  it('accepts only one winner and one loser', () => {
    expect(trackSprintHeatError([winner, loser])).toBeFalse();
    expect(trackSprintHeatError([loser, winner])).toBeFalse();
    expect(trackSprintHeatError([winner, winner])).toBeTrue();
    expect(trackSprintHeatError([loser, loser])).toBeTrue();
    expect(trackSprintHeatError([winner, undecided])).toBeTrue();
    expect(trackSprintHeatError([undecided, loser])).toBeTrue();
    expect(trackSprintHeatError([winner])).toBeTrue();
    expect(trackSprintHeatError([])).toBeTrue();
    expect(trackSprintHeatError([winner, loser, undecided])).toBeTrue();
  });
});
