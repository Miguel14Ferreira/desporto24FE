import { cricketT20Error, cricketOvers } from './community-cricket-results';
import { eventOptionsForSport, isNeutralEvent, eventPresentationFormat } from './community-round-event-type';
import { isTeamFinalEvent, teamFinalScoreLabelKey, teamFinalError } from './community-team-final-results';

describe('Cricket — completed T20 innings', () => {
  const score = (sideA:number,sideB:number) => ({sideA,sideB});
  const stats = (wicketsA:number,legalBallsA:number,wicketsB:number,legalBallsB:number) =>
    ({wicketsA,legalBallsA,wicketsB,legalBallsB});
  const entries = [{team:'A'},{team:'B'}];

  it('only enables Cricket from the closed sports catalogue', () => {
    expect(eventOptionsForSport('Cricket').map(x=>x.code)).toEqual(['CRICKET_T20']);
    expect(eventOptionsForSport('Futebol')).toEqual([]);
    expect(isNeutralEvent('Cricket','CRICKET_T20')).toBeTrue();
    expect(eventPresentationFormat('Cricket','CRICKET_T20')).toBe('team');
    expect(isTeamFinalEvent('CRICKET_T20')).toBeTrue();
    expect(teamFinalScoreLabelKey('CRICKET_T20')).toBe('communities.teamFinal.runs');
  });
  it('accepts completed innings, a chased target and tied regular innings', () => {
    expect(cricketT20Error(stats(6,120,5,110),score(160,161))).toBeFalse();
    expect(cricketT20Error(stats(10,113,10,119),score(126,118))).toBeFalse();
    expect(cricketT20Error(stats(4,120,9,120),score(149,149))).toBeFalse();
    expect(teamFinalError('CRICKET_T20',entries,score(149,149))).toBeNull();
    expect(cricketOvers(0)).toBe('0.0');
    expect(cricketOvers(116)).toBe('19.2');
    expect(cricketOvers(120)).toBe('20.0');
  });
  it('rejects invalid wickets, balls, incomplete innings and missing scores', () => {
    for (const d of [stats(-1,120,4,120),stats(11,120,1,120),stats(1,121,2,120),
      stats(2,0,2,120),stats(2,119,2,120),stats(5,120,4,110)]) {
      expect(cricketT20Error(d,score(140,139))).toBeTrue();
    }
    expect(cricketT20Error(stats(5,120,5,113),score(140,140))).toBeTrue();
    expect(cricketT20Error(null,score(140,141))).toBeTrue();
    expect(cricketT20Error(stats(5,120,6,120),null)).toBeTrue();
    expect(teamFinalError('CRICKET_T20',entries,score(1000,1))).toBe('teamFinalInvalidScore');
  });
});
