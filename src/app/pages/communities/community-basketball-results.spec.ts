import { basketballScoreError, isBasketballFinal,
  recordedBasketballFinal, basketballWinner } from './community-basketball-results';
import { eventOptionsForSport, isNeutralEvent,
  eventPresentationFormat } from './community-round-event-type';

describe('basketball final scores belong to teams, never player goals', () => {
  const players = [
    { team: 'A', performanceValue: null },
    { team: 'B', performanceValue: null }
  ];
  it('has distinct 5v5 and 3x3 types without mixing with football or other sports', () => {
    expect(eventOptionsForSport('Basquetebol').map(x => x.code))
      .toEqual(['BASKETBALL_FINAL']);
    expect(eventOptionsForSport('Basquetebol 3x3').map(x => x.code))
      .toEqual(['BASKETBALL_3X3_FINAL']);
    expect(eventOptionsForSport('Futebol')).toEqual([]);
    expect(isBasketballFinal('BASKETBALL_FINAL')).toBeTrue();
    expect(isBasketballFinal('BASKETBALL_3X3_FINAL')).toBeTrue();
    expect(isBasketballFinal(null)).toBeFalse();
    expect(isNeutralEvent('Basquetebol','BASKETBALL_FINAL')).toBeTrue();
    expect(eventPresentationFormat('Basquetebol','BASKETBALL_FINAL')).toBe('team');
    expect(eventPresentationFormat('Basquetebol 3x3','BASKETBALL_3X3_FINAL')).toBe('team');
    expect(isNeutralEvent('Basquetebol',null)).toBeFalse();
  });

  it('accepts only confirmed different final points for both teams', () => {
    for (const type of ['BASKETBALL_FINAL','BASKETBALL_3X3_FINAL']) {
      expect(basketballScoreError(type,players,{sideA:88,sideB:76})).toBeNull();
      expect(basketballScoreError(type,players,{sideA:22,sideB:21})).toBeNull();
      expect(basketballScoreError(type,players,{sideA:0,sideB:1})).toBeNull();
      expect(basketballScoreError(type,players,{sideA:null,sideB:15}))
        .toBe('basketballInvalidScore');
      expect(basketballScoreError(type,players,{sideA:20,sideB:20}))
        .toBe('basketballInvalidScore');
      expect(basketballScoreError(type,players,{sideA:1.5,sideB:21}))
        .toBe('basketballInvalidScore');
      expect(basketballScoreError(type,players,{sideA:-1,sideB:4}))
        .toBe('basketballInvalidScore');
      expect(basketballScoreError(type,players,{sideA:1000,sideB:3}))
        .toBe('basketballInvalidScore');
      expect(basketballScoreError(type,[{team:'A'},{team:''}],{sideA:8,sideB:7}))
        .toBe('basketballInvalidTeams');
      expect(basketballScoreError(type,[{team:'A'}, {team:'A'}],{sideA:8,sideB:7}))
        .toBe('basketballInvalidTeams');
      expect(basketballScoreError(type,[{team:'A',performanceValue:10}, {team:'B'}],
        {sideA:8,sideB:7})).toBe('basketballInvalidTeams');
    }
    expect(basketballScoreError(null,players,{sideA:3,sideB:1}))
      .toBe('basketballInvalidScore');
  });

  it('shows the actual winning team without changing old rounds', () => {
    expect(basketballWinner({sideA:19,sideB:22})).toBe('B');
    expect(basketballWinner({sideA:72,sideB:62})).toBe('A');
    expect(basketballWinner({sideA:null,sideB:1})).toBeNull();
    expect(recordedBasketballFinal({eventType:'BASKETBALL_FINAL',basketballScore:{sideA:70,sideB:65}}))
      .toBeTrue();
    expect(recordedBasketballFinal({eventType:null,basketballScore:null})).toBeFalse();
    expect(recordedBasketballFinal({eventType:null,basketballScore:{sideA:3,sideB:2}}))
      .toBeFalse();
  });
});
