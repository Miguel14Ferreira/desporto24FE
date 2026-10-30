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
    expect(athleticsDisciplineOptions('Ciclismo de Pista', 'TRACK_SPRINT_HEAT')).toEqual([
      'SPRINT_THIRTY_SECOND_FINAL', 'SPRINT_SIXTEENTH_FINAL', 'SPRINT_EIGHTH_FINAL', 'SPRINT_QUARTER_FINAL', 'SPRINT_SEMI_FINAL',
      'SPRINT_BRONZE_FINAL', 'SPRINT_GOLD_FINAL'
    ]);
    expect(athleticsDisciplineOptions('Ciclismo de Pista','TRACK_SPRINT_REPECHAGE'))
      .toEqual(['SPRINT_REPECHAGE_1_32','SPRINT_REPECHAGE_1_16','SPRINT_REPECHAGE_1_8']);
    expect(athleticsDisciplineOptions('Ciclismo de Pista','TRACK_SPRINT_5_8'))
      .toEqual(['SPRINT_PLACES_5_8']);
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
    expect(athleticsDisciplineValid('Ciclismo de Pista', 'TRACK_SPRINT_HEAT', 'SPRINT_SEMI_FINAL')).toBeTrue();
    expect(athleticsDisciplineValid('Ciclismo de Pista', 'TRACK_SPRINT_HEAT', null)).toBeFalse();
    expect(athleticsDisciplineValid('Ciclismo de Pista', 'TRACK_SPRINT_HEAT', 'SPRINT_POINTS_RACE')).toBeFalse();
    expect(athleticsDisciplineValid('Ciclismo de Pista', 'TRACK_FLYING_200', 'SPRINT_SEMI_FINAL')).toBeFalse();
    expect(athleticsDisciplineValid('Ciclismo de Estrada', 'TRACK_SPRINT_HEAT', 'SPRINT_GOLD_FINAL')).toBeFalse();
    expect(athleticsDisciplineValid('Surf', 'HEAT', 'PRONE')).toBeFalse();
    expect(athleticsDisciplineValid('Snowboard', 'FREESTYLE', 'LONG_JUMP')).toBeFalse();
  });
});
