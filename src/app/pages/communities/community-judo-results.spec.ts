import { eventOptionsForSport, eventPresentationFormat, isNeutralEvent }
  from './community-round-event-type';
import { isJudoBout, judoBoutError } from './community-judo-results';

describe('Judo — played bout with referee-confirmed winning method', () => {
  const entry = (team: string, result: 'WIN'|'DRAW'|'LOSS') => ({team,result});

  it('lists only Judo win methods and preserves strict sport isolation', () => {
    const types = eventOptionsForSport('Judo').map(e => e.code);
    expect(types).toEqual(['JUDO_IPPON','JUDO_AWASETE_IPPON',
      'JUDO_WAZA_ARI','JUDO_YUKO','JUDO_HANSOKU_MAKE']);
    expect(eventOptionsForSport('Xadrez')).not.toContain(
      jasmine.objectContaining({code:'JUDO_IPPON'}));
    for (const type of types) {
      expect(isJudoBout(type)).toBeTrue();
      expect(eventPresentationFormat('Judo',type)).toBe('duel');
      expect(isNeutralEvent('Judo',type)).toBeTrue();
    }
    expect(isJudoBout('CHESS_GAME')).toBeFalse();
    expect(isJudoBout(null)).toBeFalse();
  });

  it('accepts either winner with White and Blue judogi', () => {
    expect(judoBoutError([entry('WHITE','WIN'),entry('BLUE','LOSS')])).toBeFalse();
    expect(judoBoutError([entry('BLUE','WIN'),entry('WHITE','LOSS')])).toBeFalse();
  });

  it('rejects false draws, two winners, wrong colors and extra people', () => {
    for (const wrong of [
      [entry('WHITE','DRAW'),entry('BLUE','DRAW')],
      [entry('WHITE','WIN'),entry('BLUE','WIN')],
      [entry('WHITE','LOSS'),entry('BLUE','LOSS')],
      [entry('WHITE','WIN'),entry('WHITE','LOSS')],
      [entry('BLUE','WIN')], [entry('BLUE','WIN'),entry('WHITE','LOSS'),entry('BLUE','LOSS')],
      [entry('RED','WIN'),entry('BLUE','LOSS')]
    ]) {
      expect(judoBoutError(wrong)).toBeTrue();
    }
  });
});
