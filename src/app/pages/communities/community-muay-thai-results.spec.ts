import { eventOptionsForSport, eventPresentationFormat, isNeutralEvent }
  from './community-round-event-type';
import { isMuayThaiEvent, muayThaiResultError } from './community-muay-thai-results';
import { CommunityRoundEntryDraft } from '../model/community-group';

describe('IFMA Muay Thai Full Contact final decisions', () => {
  const fighter = (username:string,team:string,result:'WIN'|'LOSS'|'DRAW',score:number|null=null) =>
    ({username,team,result,performanceValue:score,waveScore1:null,waveScore2:null} as CommunityRoundEntryDraft);
  const types=['IFMA_FULL_WP','IFMA_FULL_KO','IFMA_FULL_RSCS','IFMA_FULL_RSCI'];
  it('limits the four variants to the existing Muay Thai discipline', () => {
    expect(eventOptionsForSport('Muay Thai').map(x=>String(x.code))).toEqual(types);
    expect(eventOptionsForSport('Futebol')).toEqual([]);
    expect(isMuayThaiEvent('BOXING_WB_KO')).toBeFalse();
    expect(isMuayThaiEvent(null)).toBeFalse();
    for (const type of types) {
      expect(eventPresentationFormat('Muay Thai', type as any)).toBe('duel');
      expect(isNeutralEvent('Muay Thai',type as any)).toBeTrue();
      expect(muayThaiResultError(type,[fighter('a','RED','WIN'),fighter('b','BLUE','LOSS')]))
        .toBeFalse();
      expect(muayThaiResultError(type,[fighter('a','RED','LOSS'),fighter('b','BLUE','WIN')]))
        .toBeFalse();
    }
  });
  it('rejects draws, missing corners, duplicate identities or scalar judge scores', () => {
    for (const type of types) {
      expect(muayThaiResultError(type,[fighter('a','RED','WIN')])).toBeTrue();
      expect(muayThaiResultError(type,[fighter('a','RED','WIN'),fighter('b','RED','LOSS')]))
        .toBeTrue();
      expect(muayThaiResultError(type,[fighter('a','RED','WIN'),fighter('a','BLUE','LOSS')]))
        .toBeTrue();
      expect(muayThaiResultError(type,[fighter('a','RED','WIN'),fighter('b','BLUE','WIN')]))
        .toBeTrue();
      expect(muayThaiResultError(type,[fighter('a','RED','DRAW'),fighter('b','BLUE','DRAW')]))
        .toBeTrue();
      expect(muayThaiResultError(type,[fighter('a','RED','WIN',30),fighter('b','BLUE','LOSS')]))
        .toBeTrue();
    }
  });
});
