import { trackSprintHeatError } from './community-track-sprint-results';

describe('Track cycling Sprint knockout heat', () => {
  const winner = { result: 'WIN' as const };
  const loser = { result: 'LOSS' as const };
  const undecided = { result: 'DRAW' as const };
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
