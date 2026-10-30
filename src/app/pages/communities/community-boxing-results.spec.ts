import { eventOptionsForSport, eventPresentationFormat, isNeutralEvent }
  from './community-round-event-type';
import { boxingResultError, isBoxingEvent } from './community-boxing-results';
import { CommunityRoundEntryDraft } from '../model/community-group';

describe('World Boxing individual confirmed decisions', () => {
  const boxer = (username: string, team: string, result: 'WIN'|'LOSS'|'DRAW',
    mark: number | null = null) =>
    ({username,team,result,performanceValue:mark,waveScore1:null,waveScore2:null} as CommunityRoundEntryDraft);
  it('registers three events for existing Boxe and no other sport', () => {
    expect(eventOptionsForSport('Boxe').map(x=>x.code))
      .toEqual(['BOXING_WB_POINTS','BOXING_WB_KO','BOXING_WB_RSC']);
    expect(eventOptionsForSport('Futebol')).toEqual([]);
    expect(isBoxingEvent('BOXING_PRO_TKO')).toBeFalse();
    for (const type of ['BOXING_WB_POINTS','BOXING_WB_KO','BOXING_WB_RSC']) {
      expect(eventPresentationFormat('Boxe',type)).toBe('duel');
      expect(isNeutralEvent('Boxe',type)).toBeTrue();
      expect(boxingResultError(type,[boxer('a','RED','WIN'),boxer('b','BLUE','LOSS')]))
        .toBeFalse();
      expect(boxingResultError(type,[boxer('a','RED','LOSS'),boxer('b','BLUE','WIN')]))
        .toBeFalse();
    }
  });
  it('requires two distinct red and blue contestants with one winner', () => {
    for (const type of ['BOXING_WB_POINTS','BOXING_WB_KO','BOXING_WB_RSC']) {
      expect(boxingResultError(type,[boxer('a','RED','WIN')])).toBeTrue();
      expect(boxingResultError(type,[boxer('a','RED','WIN'),boxer('a','BLUE','LOSS')]))
        .toBeTrue();
      expect(boxingResultError(type,[boxer('a','RED','WIN'),boxer('b','RED','LOSS')]))
        .toBeTrue();
      expect(boxingResultError(type,[boxer('a','RED','WIN'),boxer('b','BLUE','WIN')]))
        .toBeTrue();
      expect(boxingResultError(type,[boxer('a','RED','DRAW'),boxer('b','BLUE','DRAW')]))
        .toBeTrue();
      expect(boxingResultError(type,[boxer('a','RED','WIN',30),boxer('b','BLUE','LOSS')]))
        .toBeTrue();
    }
  });
});
