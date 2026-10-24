import { eventOptionsForSport, eventPresentationFormat, isNeutralEvent }
  from './community-round-event-type';
import { bjjResultError, isBjjEvent, isBjjPoints } from './community-bjj-results';
import { CommunityRoundEntryDraft } from '../model/community-group';

describe('BJJ IBJJF-style individual Gi results', () => {
  const entry = (username:string, team:string, result:'WIN'|'LOSS'|'DRAW', score:number|null) =>
    ({username,team,result,performanceValue:score} as CommunityRoundEntryDraft);
  it('uses exactly the existing Jiu-Jitsu Brasileiro catalogue sport', () => {
    expect(eventOptionsForSport('Jiu-Jitsu Brasileiro').map(x=>x.code))
      .toEqual(['BJJ_IBJJF_GI_SUBMISSION','BJJ_IBJJF_GI_POINTS']);
    expect(eventOptionsForSport('Judo')).toEqual(eventOptionsForSport('Judo'));
    expect(eventOptionsForSport('Futebol')).toEqual([]);
    expect(isBjjEvent('TKD_KYORUGI_BEST3')).toBeFalse();
    expect(isBjjPoints('BJJ_IBJJF_GI_POINTS')).toBeTrue();
    expect(eventPresentationFormat('Jiu-Jitsu Brasileiro', 'BJJ_IBJJF_GI_POINTS')).toBe('duel');
    expect(isNeutralEvent('Jiu-Jitsu Brasileiro','BJJ_IBJJF_GI_SUBMISSION')).toBeTrue();
  });
  it('submission records confirmation without a numeric points score', () => {
    expect(bjjResultError('BJJ_IBJJF_GI_SUBMISSION',
      [entry('a','A','WIN',null),entry('b','B','LOSS',null)])).toBeFalse();
    expect(bjjResultError('BJJ_IBJJF_GI_SUBMISSION',
      [entry('a','A','WIN',2),entry('b','B','LOSS',null)])).toBeTrue();
  });
  it('point victory must match confirmed distinct final scores', () => {
    expect(bjjResultError('BJJ_IBJJF_GI_POINTS',
      [entry('a','A','WIN',4),entry('b','B','LOSS',2)])).toBeFalse();
    expect(bjjResultError('BJJ_IBJJF_GI_POINTS',
      [entry('a','A','LOSS',0),entry('b','B','WIN',7)])).toBeFalse();
    for (const bad of [null,-1,1,1.25,1000000,Infinity]) {
      expect(bjjResultError('BJJ_IBJJF_GI_POINTS',
        [entry('a','A','WIN',bad),entry('b','B','LOSS',0)])).toBeTrue();
    }
    expect(bjjResultError('BJJ_IBJJF_GI_POINTS',
      [entry('a','A','WIN',4),entry('b','B','LOSS',4)])).toBeTrue();
    expect(bjjResultError('BJJ_IBJJF_GI_POINTS',
      [entry('a','A','WIN',2),entry('b','B','LOSS',4)])).toBeTrue();
  });
  it('requires unique identities and one athlete on each side', () => {
    expect(bjjResultError('BJJ_IBJJF_GI_POINTS',
      [entry('a','A','WIN',4),entry('a','B','LOSS',2)])).toBeTrue();
    expect(bjjResultError('BJJ_IBJJF_GI_POINTS',
      [entry('a','A','WIN',4),entry('b','A','LOSS',2)])).toBeTrue();
    expect(bjjResultError('BJJ_IBJJF_GI_POINTS',
      [entry('a','A','WIN',4),entry('b','B','WIN',2)])).toBeTrue();
    expect(bjjResultError('BJJ_IBJJF_GI_POINTS',
      [entry('a','A','WIN',4)])).toBeTrue();
  });
});
