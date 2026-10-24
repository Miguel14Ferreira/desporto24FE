import { CommunityEventType, eventOptionsForSport, eventPresentationFormat, isNeutralEvent }
  from './community-round-event-type';
import { isKickboxingEvent, isKickboxingPointFighting, kickboxingResultError }
  from './community-kickboxing-results';
import { CommunityRoundEntryDraft } from '../model/community-group';

describe('WAKO Kickboxing specific contest decisions', () => {
  const e = (username:string, team:string, result:'WIN'|'LOSS'|'DRAW', score:number|null = null) =>
    ({username,team,result,performanceValue:score,waveScore1:null,waveScore2:null} as CommunityRoundEntryDraft);
  const types: CommunityEventType[] = ['WAKO_POINT_FIGHTING','WAKO_LIGHT_CONTACT','WAKO_KICK_LIGHT',
    'WAKO_FULL_CONTACT','WAKO_LOW_KICK','WAKO_K1'];
  it('selects precisely the six WAKO disciplines for existing Kickboxing only', () => {
    expect(eventOptionsForSport('Kickboxing').map(x=>x.code)).toEqual(types);
    expect(eventOptionsForSport('Futebol')).toEqual([]);
    expect(isKickboxingEvent('BOXING_WB_KO')).toBeFalse();
    for(const type of types) {
      expect(eventPresentationFormat('Kickboxing',type)).toBe('duel');
      expect(isNeutralEvent('Kickboxing',type)).toBeTrue();
    }
  });
  it('point fighting requires final integer scores and correct winner', () => {
    expect(isKickboxingPointFighting(types[0])).toBeTrue();
    expect(kickboxingResultError(types[0],[e('r','RED','WIN',8),e('b','BLUE','LOSS',4)]))
      .toBeFalse();
    expect(kickboxingResultError(types[0],[e('r','RED','LOSS',0),e('b','BLUE','WIN',5)]))
      .toBeFalse();
    for(const bad of [null,-1,1.5,1000000,Infinity]) {
      expect(kickboxingResultError(types[0],[e('r','RED','WIN',bad),e('b','BLUE','LOSS',0)]))
        .toBeTrue();
    }
    expect(kickboxingResultError(types[0],[e('r','RED','WIN',2),e('b','BLUE','LOSS',2)]))
      .toBeTrue();
    expect(kickboxingResultError(types[0],[e('r','RED','WIN',1),e('b','BLUE','LOSS',5)]))
      .toBeTrue();
  });
  it('five judges-decision disciplines accept WIN/LOSS without fake scalar score', () => {
    for(const type of types.slice(1)) {
      expect(isKickboxingPointFighting(type)).toBeFalse();
      expect(kickboxingResultError(type,[e('r','RED','WIN'),e('b','BLUE','LOSS')]))
        .toBeFalse();
      expect(kickboxingResultError(type,[e('r','RED','LOSS'),e('b','BLUE','WIN')]))
        .toBeFalse();
      expect(kickboxingResultError(type,[e('r','RED','WIN',30),e('b','BLUE','LOSS')]))
        .toBeTrue();
    }
  });
  it('rejects duplicate athletes, missing corners or no single winner', () => {
    expect(kickboxingResultError(types[0],[e('x','RED','WIN',7),e('x','BLUE','LOSS',2)]))
      .toBeTrue();
    expect(kickboxingResultError(types[0],[e('a','RED','WIN',7),e('b','RED','LOSS',2)]))
      .toBeTrue();
    expect(kickboxingResultError(types[0],[e('a','RED','WIN',7),e('b','BLUE','WIN',2)]))
      .toBeTrue();
    expect(kickboxingResultError(types[0],[e('a','RED','WIN',7)])).toBeTrue();
  });
});
