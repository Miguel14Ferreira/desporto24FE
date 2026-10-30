import { trackSprintHeatError, trackSprintPlacesError } from './community-track-sprint-results';

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
  it('requires four explicit unique 5th–8th places without fake WDL', () => {
    const rows = [5,6,7,8].map((p,i)=>({username:'r'+i,result:'DRAW' as const,finishPosition:p}));
    expect(trackSprintPlacesError(rows)).toBeFalse();
    expect(trackSprintPlacesError(rows.slice(0,3))).toBeTrue();
    expect(trackSprintPlacesError(rows.map((r,i)=>i===3?{...r,finishPosition:5}:r))).toBeTrue();
    expect(trackSprintPlacesError(rows.map((r,i)=>i===3?{...r,username:'r0'}:r))).toBeTrue();
    expect(trackSprintPlacesError(rows.map((r,i)=>i===3?{...r,result:'WIN' as const}:r))).toBeTrue();
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
