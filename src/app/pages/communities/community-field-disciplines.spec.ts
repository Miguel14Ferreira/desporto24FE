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
    expect(athleticsDisciplineOptions('Ginástica Artística', 'APPARATUS')).toContain('BALANCE_BEAM');
    expect(athleticsDisciplineOptions('Bodyboard', 'BODYBOARD_HEAT')).toEqual(['PRONE', 'DROP_KNEE']);
    expect(athleticsDisciplineOptions('Ginástica Rítmica', 'RHYTHMIC_APPARATUS'))
      .toEqual(['HOOP', 'BALL', 'CLUBS', 'RIBBON']);
  });
  it('never mixes disciplines into races or other sports', () => {
    expect(athleticsDisciplineValid('Atletismo', 'JUMP', 'LONG_JUMP')).toBeTrue();
    expect(athleticsDisciplineValid('Atletismo', 'JUMP', null)).toBeFalse();
    expect(athleticsDisciplineValid('Atletismo', 'JUMP', 'HAMMER')).toBeFalse();
    expect(athleticsDisciplineValid('Atletismo', 'THROW', 'JAVELIN')).toBeTrue();
    expect(athleticsDisciplineValid('Snowboard', 'FREESTYLE', null)).toBeTrue();
    expect(athleticsDisciplineValid('Ginástica Artística', 'APPARATUS', 'FLOOR')).toBeTrue();
    expect(athleticsDisciplineValid('Ginástica Artística', 'APPARATUS', null)).toBeFalse();
    expect(athleticsDisciplineValid('Bodyboard', 'BODYBOARD_HEAT', 'PRONE')).toBeTrue();
    expect(athleticsDisciplineValid('Bodyboard', 'BODYBOARD_HEAT', 'DROP_KNEE')).toBeTrue();
    expect(athleticsDisciplineValid('Bodyboard', 'BODYBOARD_HEAT', null)).toBeFalse();
    expect(athleticsDisciplineValid('Bodyboard', 'BODYBOARD_HEAT', 'FLOOR')).toBeFalse();
    expect(athleticsDisciplineValid('Ginástica Rítmica', 'RHYTHMIC_APPARATUS', 'RIBBON')).toBeTrue();
    expect(athleticsDisciplineValid('Ginástica Rítmica', 'RHYTHMIC_APPARATUS', null)).toBeFalse();
    expect(athleticsDisciplineValid('Ginástica Rítmica', 'RHYTHMIC_APPARATUS', 'FLOOR')).toBeFalse();
    expect(athleticsDisciplineValid('Natação Artística', 'ARTISTIC_SOLO_FREE', 'BALL')).toBeFalse();
    expect(athleticsDisciplineValid('Surf', 'HEAT', 'PRONE')).toBeFalse();
    expect(athleticsDisciplineValid('Snowboard', 'FREESTYLE', 'LONG_JUMP')).toBeFalse();
  });
});
