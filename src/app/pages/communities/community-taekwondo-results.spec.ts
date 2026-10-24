import { eventOptionsForSport, eventPresentationFormat, isNeutralEvent }
  from './community-round-event-type';
import { eventPerformanceEntries, eventPerformancePlace, performanceKind }
  from './community-performance-results';
import { isTaekwondoKyorugi, isTaekwondoPoomsae, taekwondoResultError }
  from './community-taekwondo-results';
import { CommunityRound, CommunityRoundEntry, CommunityRoundEntryDraft } from '../model/community-group';

describe('Taekwondo results by discipline', () => {
  const athlete = (username: string, team: string, result: 'WIN'|'LOSS'|'DRAW', score: number|null) =>
    ({username,team,result,performanceValue:score} as CommunityRoundEntryDraft);
  it('exposes typed formats for only existing Taekwondo', () => {
    expect(eventOptionsForSport('Taekwondo').map(x => x.code))
      .toEqual(['TKD_KYORUGI_BEST3','TKD_POOMSAE_RECOGNIZED','TKD_POOMSAE_FREESTYLE']);
    expect(eventOptionsForSport('Futebol')).toEqual([]);
    expect(eventPresentationFormat('Taekwondo','TKD_KYORUGI_BEST3')).toBe('duel');
    expect(eventPresentationFormat('Taekwondo','TKD_POOMSAE_RECOGNIZED')).toBe('judged');
    expect(isNeutralEvent('Taekwondo','TKD_POOMSAE_FREESTYLE')).toBeTrue();
    expect(performanceKind('TKD_POOMSAE_RECOGNIZED')).toBe('poomsae');
  });
  it('kinematic best of 3 requires one 2-round winner and correct Chung/Hong', () => {
    const a=athlete('a','CHUNG','WIN',2),b=athlete('b','HONG','LOSS',1);
    expect(taekwondoResultError('TKD_KYORUGI_BEST3',[a,b])).toBeFalse();
    expect(taekwondoResultError('TKD_KYORUGI_BEST3',[athlete('a','CHUNG','WIN',2),athlete('b','HONG','LOSS',0)])).toBeFalse();
    for(const bad of [null,-1,1.5,3]) {
      expect(taekwondoResultError('TKD_KYORUGI_BEST3',[athlete('a','CHUNG','WIN',bad),b])).toBeTrue();
    }
    expect(taekwondoResultError('TKD_KYORUGI_BEST3',[a,athlete('b','HONG','WIN',1)])).toBeTrue();
    expect(taekwondoResultError('TKD_KYORUGI_BEST3',[a,athlete('b','CHUNG','LOSS',1)])).toBeTrue();
    expect(taekwondoResultError('TKD_KYORUGI_BEST3',[a])).toBeTrue();
  });
  it('judged individual poomsae validates marks and shares tied ranks', () => {
    for(const type of ['TKD_POOMSAE_RECOGNIZED','TKD_POOMSAE_FREESTYLE']) {
      expect(isTaekwondoPoomsae(type)).toBeTrue();
      expect(isTaekwondoKyorugi(type)).toBeFalse();
      expect(taekwondoResultError(type,[athlete('a','','DRAW',9.333),
        athlete('b','','DRAW',9.333),athlete('c','','DRAW',0)])).toBeFalse();
      for(const bad of [null,-1,10.1,8.9999,Infinity]) {
        expect(taekwondoResultError(type,[athlete('a','','DRAW',bad)])).toBeTrue();
      }
      expect(taekwondoResultError(type,[athlete('a','A','DRAW',9)])).toBeTrue();
      expect(taekwondoResultError(type,[athlete('a','','WIN',9)])).toBeTrue();
      expect(taekwondoResultError(type,[athlete('a','','DRAW',9),athlete('a','','DRAW',8)])).toBeTrue();
    }
    const a={performanceValue:8} as CommunityRoundEntry;
    const b={performanceValue:9} as CommunityRoundEntry;
    const c={performanceValue:9} as CommunityRoundEntry;
    const r={eventType:'TKD_POOMSAE_RECOGNIZED',entries:[a,b,c]} as CommunityRound;
    const sorted=eventPerformanceEntries(r);
    expect(sorted).toEqual([b,c,a]);
    expect(eventPerformancePlace(sorted,b,r.eventType)).toBe(1);
    expect(eventPerformancePlace(sorted,c,r.eventType)).toBe(1);
    expect(eventPerformancePlace(sorted,a,r.eventType)).toBe(3);
  });
});
