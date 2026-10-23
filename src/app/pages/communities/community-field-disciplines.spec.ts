import { athleticsDisciplineOptions, athleticsDisciplineValid } from './community-field-disciplines';

describe('Athletics field disciplines', () => {
  it('offers compatible jump or throw disciplines only', () => {
    expect(athleticsDisciplineOptions('Atletismo', 'JUMP')).toEqual([
      'LONG_JUMP', 'TRIPLE_JUMP', 'HIGH_JUMP', 'POLE_VAULT'
    ]);
    expect(athleticsDisciplineOptions('Atletismo', 'THROW')).toEqual([
      'SHOT_PUT', 'DISCUS', 'JAVELIN', 'HAMMER'
    ]);
    expect(athleticsDisciplineOptions('Atletismo', 'TRACK')).toEqual([]);
    expect(athleticsDisciplineOptions('Futebol', 'JUMP')).toEqual([]);
  });
  it('never mixes disciplines into races or other sports', () => {
    expect(athleticsDisciplineValid('Atletismo', 'JUMP', 'LONG_JUMP')).toBeTrue();
    expect(athleticsDisciplineValid('Atletismo', 'JUMP', null)).toBeFalse();
    expect(athleticsDisciplineValid('Atletismo', 'JUMP', 'HAMMER')).toBeFalse();
    expect(athleticsDisciplineValid('Atletismo', 'THROW', 'JAVELIN')).toBeTrue();
    expect(athleticsDisciplineValid('Snowboard', 'FREESTYLE', null)).toBeTrue();
    expect(athleticsDisciplineValid('Snowboard', 'FREESTYLE', 'LONG_JUMP')).toBeFalse();
  });
});
