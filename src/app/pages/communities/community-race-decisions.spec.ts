import { raceDecisionError } from './community-race-decisions';

describe('race steward decisions', () => {
  it('accepts timed penalty with original recorded time and reason', () => {
    expect(raceDecisionError(5.25, false, 'Limites de pista', 92.43)).toBeFalse();
    expect(raceDecisionError(0, true, 'Desclassificação', null)).toBeFalse();
    expect(raceDecisionError(0, false, '', null)).toBeFalse();
  });
  it('rejects nonexistent original time, incomplete reason or invalid time', () => {
    expect(raceDecisionError(5, false, 'Motivo', null)).toBeTrue();
    expect(raceDecisionError(5, false, '', 92)).toBeTrue();
    expect(raceDecisionError(0, true, '', 92)).toBeTrue();
    expect(raceDecisionError(-1, false, 'Motivo', 92)).toBeTrue();
    expect(raceDecisionError(3600.001, false, 'Motivo', 92)).toBeTrue();
    expect(raceDecisionError(0.0001, false, 'Motivo', 92)).toBeTrue();
  });
  it('preserves empty and historical cases without invented results', () => {
    expect(raceDecisionError(0, false, '', undefined)).toBeFalse();
  });
});
