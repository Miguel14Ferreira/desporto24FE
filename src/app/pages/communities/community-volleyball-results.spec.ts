import {
  isVolleyballEvent, isFootvolleyEvent, isTeqballEvent,
  volleyballSideLabelKey, volleyballMemberSelectorKey,
  volleyballMatchError, volleyballMinSets,
  volleyballMaxSets, volleyballFormatHint, volleyballSetWinner, volleyballSetTotals,
  recordedVolleyballMatch
} from './community-volleyball-results';
import { eventOptionsForSport, eventPresentationFormat, isNeutralEvent }
  from './community-round-event-type';

describe('volleyball and beach volleyball FIVB-style complete match results', () => {
  const indoor = [{team:'A'},{team:'B'}];
  const beach = [{team:'A'},{team:'A'},{team:'B'},{team:'B'}];
  const score = (sideA: number, sideB: number) => ({sideA,sideB});
  const five = (sets: Array<{sideA:number;sideB:number}>) =>
    volleyballMatchError('VOLLEYBALL_FINAL',indoor,sets);
  const three = (sets: Array<{sideA:number;sideB:number}>) =>
    volleyballMatchError('BEACH_VOLLEY_FINAL',beach,sets);

  it('defines dedicated sport-specific types and neutral generic standings', () => {
    expect(eventOptionsForSport('Voleibol').map(x=>x.code)).toEqual(['VOLLEYBALL_FINAL']);
    expect(eventOptionsForSport('Voleibol de Praia').map(x=>x.code)).toEqual(['BEACH_VOLLEY_FINAL']);
    expect(eventOptionsForSport('Futebol')).toEqual([]);
    expect(isVolleyballEvent('VOLLEYBALL_FINAL')).toBeTrue();
    expect(isVolleyballEvent('BEACH_VOLLEY_FINAL')).toBeTrue();
    expect(isVolleyballEvent('BASKETBALL_FINAL')).toBeFalse();
    expect(isNeutralEvent('Voleibol','VOLLEYBALL_FINAL')).toBeTrue();
    expect(isNeutralEvent('Voleibol de Praia','BEACH_VOLLEY_FINAL')).toBeTrue();
    expect(eventPresentationFormat('Voleibol','VOLLEYBALL_FINAL')).toBe('team');
    expect(volleyballMinSets('VOLLEYBALL_FINAL')).toBe(3);
    expect(volleyballMaxSets('VOLLEYBALL_FINAL')).toBe(5);
    expect(volleyballMinSets('BEACH_VOLLEY_FINAL')).toBe(2);
    expect(volleyballMaxSets('BEACH_VOLLEY_FINAL')).toBe(3);
  });
  it('registers footvolley only for canonical Futevólei and preserves distinct formats', () => {
    const formats: Array<[string,number,number]> = [
      ['FOOTVOLLEY_SINGLE_18',1,1], ['FOOTVOLLEY_BEST_OF_3',2,3],
      ['FOOTVOLLEY_SINGLE_15',1,1]
    ];
    for (const [type,min,max] of formats) {
      expect(eventOptionsForSport('Futevólei').map(x=>x.code)).toContain(type as any);
      expect(isVolleyballEvent(type)).toBeTrue();
      expect(isFootvolleyEvent(type)).toBeTrue();
      expect(volleyballMinSets(type)).toBe(min);
      expect(volleyballMaxSets(type)).toBe(max);
      expect(volleyballFormatHint(type)).toContain('footvolley');
      expect(isNeutralEvent('Futevólei',type)).toBeTrue();
      expect(eventPresentationFormat('Futevólei',type)).toBe('team');
    }
    expect(eventOptionsForSport('Futebol')).toEqual([]);
    expect(isFootvolleyEvent('BEACH_VOLLEY_FINAL')).toBeFalse();
  });
  it('validates footvolley 18-point singles, 18/18/15 and 15-point singles', () => {
    const a=(type:string,sets:Array<{sideA:number;sideB:number}>)=>
      volleyballMatchError(type,beach,sets);
    expect(a('FOOTVOLLEY_SINGLE_18',[score(18,16)])).toBeNull();
    expect(a('FOOTVOLLEY_SINGLE_18',[score(23,21)])).toBeNull();
    expect(a('FOOTVOLLEY_SINGLE_15',[score(15,11)])).toBeNull();
    expect(a('FOOTVOLLEY_BEST_OF_3',[score(18,16),score(18,13)])).toBeNull();
    expect(a('FOOTVOLLEY_BEST_OF_3',[score(18,16),score(16,18),score(17,15)])).toBeNull();
    expect(a('FOOTVOLLEY_SINGLE_18',[score(15,11)])).toBe('volleyballInvalidScore');
    expect(a('FOOTVOLLEY_SINGLE_15',[score(18,11)])).toBe('volleyballInvalidScore');
    expect(a('FOOTVOLLEY_BEST_OF_3',[score(18,16),score(18,16),score(15,11)]))
      .toBe('volleyballInvalidSets');
    expect(a('FOOTVOLLEY_BEST_OF_3',[score(18,16),score(16,18),score(15,14)]))
      .toBe('volleyballInvalidScore');
    expect(a('FOOTVOLLEY_SINGLE_18',[score(18,18)])).toBe('volleyballInvalidScore');
    expect(volleyballMatchError('FOOTVOLLEY_SINGLE_18',indoor,[score(18,12)]))
      .toBe('volleyballInvalidTeams');
    expect(volleyballMatchError('BEACH_VOLLEY_FINAL',beach,[score(18,16)]))
      .toBe('volleyballInvalidSets');
  });
  it('accepts best of five indoor, including deciding fifth and extended deuces', () => {
    expect(five([score(25,20),score(25,23),score(25,0)])).toBeNull();
    expect(five([score(26,24),score(23,25),score(25,19),score(20,25),score(17,15)])).toBeNull();
    expect(five([score(25,23),score(25,21)])).toBe('volleyballInvalidSets');
    expect(five([score(25,23),score(25,21),score(25,19),score(25,17)]))
      .toBe('volleyballInvalidSets');
    expect(five([score(25,21),score(20,25),score(25,21),score(20,25),score(15,14)]))
      .toBe('volleyballInvalidScore');
  });
  it('accepts beach best of three, with 21 / deciding 15', () => {
    expect(three([score(21,19),score(21,17)])).toBeNull();
    expect(three([score(21,19),score(19,21),score(15,13)])).toBeNull();
    expect(three([score(25,23),score(21,19)])).toBeNull();
    expect(three([score(21,19),score(19,21),score(40,38)])).toBeNull();
    expect(three([score(21,19),score(21,19),score(15,13)]))
      .toBe('volleyballInvalidSets');
    expect(three([score(21,19),score(19,21),score(15,14)]))
      .toBe('volleyballInvalidScore');
  });
  it('validates Teqball 2026 singles and doubles and a two-point deciding set',()=>{
    const singles=[{team:'A'},{team:'B'}];
    const doubles=[{team:'A'},{team:'A'},{team:'B'},{team:'B'}];
    for(const [type,players] of [
      ['TEQBALL_SINGLES',singles],['TEQBALL_DOUBLES',doubles]
    ] as const) {
      expect(type.length).toBeLessThanOrEqual(20);
      expect(eventOptionsForSport('Teqball').map(x=>x.code)).toContain(type);
      expect(isTeqballEvent(type)).toBeTrue();
      expect(isVolleyballEvent(type)).toBeTrue();
      expect(isFootvolleyEvent(type)).toBeFalse();
      expect(isNeutralEvent('Teqball',type)).toBeTrue();
      expect(eventPresentationFormat('Teqball',type)).toBe('team');
      expect(volleyballMinSets(type)).toBe(2);
      expect(volleyballMaxSets(type)).toBe(3);
      expect(volleyballFormatHint(type)).toContain('teqball');
      expect(volleyballMatchError(type,players,[score(12,11),score(12,0)])).toBeNull();
      expect(volleyballMatchError(type,players,[score(12,11),score(11,12),score(14,12)])).toBeNull();
      expect(volleyballMatchError(type,players,[score(11,12),score(12,11),score(12,10)])).toBeNull();
      for(const invalid of [
        [score(12,11)], [score(11,10),score(12,8)],
        [score(13,11),score(12,8)], [score(12,8),score(12,7),score(12,2)],
        [score(12,8),score(8,12),score(12,11)],
        [score(12,8),score(8,12),score(14,11)]
      ])expect(volleyballMatchError(type,players,invalid)).not.toBeNull();
      expect(volleyballMatchError(type,type==='TEQBALL_SINGLES'?doubles:singles,
        [score(12,8),score(12,5)])).toBe('volleyballInvalidTeams');
      expect(recordedVolleyballMatch({eventType:type,setScores:[score(12,5),score(12,8)]})).toBeTrue();
    }
    expect(volleyballSideLabelKey('TEQBALL_SINGLES','A')).toBe('communities.teamFinal.playerA');
    expect(volleyballSideLabelKey('TEQBALL_DOUBLES','B')).toBe('communities.volleyball.sideB');
    expect(volleyballMemberSelectorKey('TEQBALL_SINGLES')).toBe('communities.teqball.player');
    expect(volleyballSideLabelKey('BEACH_VOLLEY_FINAL','A')).toBe('communities.volleyball.sideA');
  });
  it('rejects incomplete/impossible points and incorrect team memberships', () => {
    for(const broken of [score(24,24),score(25,24),score(26,23),
      score(24,20),score(-1,25),score(1000,998),score(30,27)]) {
      expect(five([broken,score(25,23),score(25,21)])).toBe('volleyballInvalidScore');
    }
    expect(volleyballMatchError('BEACH_VOLLEY_FINAL',indoor,
      [score(21,19),score(21,18)])).toBe('volleyballInvalidTeams');
    expect(volleyballMatchError('VOLLEYBALL_FINAL',[{team:'A'},{team:'A'}],
      [score(25,19),score(25,20),score(25,19)])).toBe('volleyballInvalidTeams');
    expect(volleyballMatchError('VOLLEYBALL_FINAL',[{team:'A',performanceValue:20},{team:'B'}],
      [score(25,19),score(25,20),score(25,19)])).toBe('volleyballInvalidTeams');
  });
  it('ranks winner by sets and preserves legacy/racket match presentations', () => {
    const sets=[score(25,18),score(20,25),score(25,21),score(25,10)];
    expect(volleyballSetWinner(sets)).toBe('A');
    expect(volleyballSetTotals(sets)).toEqual({sideA:3,sideB:1});
    expect(volleyballSetWinner([score(25,18),score(18,25)])).toBeNull();
    expect(recordedVolleyballMatch({eventType:'VOLLEYBALL_FINAL',setScores:sets})).toBeTrue();
    expect(recordedVolleyballMatch({eventType:null,setScores:sets})).toBeFalse();
    expect(recordedVolleyballMatch({eventType:'BASKETBALL_FINAL',setScores:null})).toBeFalse();
  });
});
