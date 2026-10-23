import { racketMatchWinner, racketSupportsSets, racketUsesPointsPerSet,
  recordedRacketMatch } from './community-racket-results';
import { CommunitySetScore } from '../model/community-group';

describe('structured racket matches', () => {
  const entries = (teams: string[]) => teams.map(team => ({ team }));
  const scores: CommunitySetScore[] = [
    { sideA: 6, sideB: 4 }, { sideA: 3, sideB: 6 }, { sideA: 7, sideB: 5 }
  ];

  it('limits this scoring to actual racket sports', () => {
    for (const sport of ['Ténis', 'Padel', 'Badminton', 'Squash',
      'Pickleball', 'Ténis de mesa', 'Ténis de praia']) {
      expect(racketSupportsSets(sport)).withContext(sport).toBeTrue();
    }
    expect(racketSupportsSets('Futebol')).toBeFalse();
    expect(racketSupportsSets('Judo')).toBeFalse();
    expect(racketUsesPointsPerSet('Badminton')).toBeTrue();
    expect(racketUsesPointsPerSet('Ténis')).toBeFalse();
  });

  it('derives correct winner for singles and doubles', () => {
    expect(racketMatchWinner(entries(['A', 'B']), 'SINGLES', scores)).toBe('A');
    expect(racketMatchWinner(entries(['A','A','B','B']), 'DOUBLES', scores)).toBe('A');
    expect(racketMatchWinner(entries(['A','B']), 'SINGLES',
      [{sideA: 4, sideB: 6}, {sideA: 4,sideB: 6}])).toBe('B');
  });

  it('refuses partial or ambiguous scores or player teams', () => {
    expect(racketMatchWinner(entries(['A','B']), 'DOUBLES', scores)).toBeNull();
    expect(racketMatchWinner(entries(['A','A']), 'SINGLES', scores)).toBeNull();
    expect(racketMatchWinner(entries(['A','B']), 'SINGLES', [
      { sideA: 6, sideB: 4 }, {sideA: 4, sideB: 6}
    ])).toBeNull();
    expect(racketMatchWinner(entries(['A','B']), 'SINGLES', [
      { sideA: 6, sideB: 6 }
    ])).toBeNull();
    expect(racketMatchWinner(entries(['A','B']), 'SINGLES', [
      { sideA: -1, sideB: 6 }
    ])).toBeNull();
  });

  it('leaves imported and legacy rounds untouched', () => {
    const round: any = { sport: 'Ténis', matchFormat: null, setScores: [],
      entries: [] };
    expect(recordedRacketMatch(round)).toBeFalse();
    expect(recordedRacketMatch({...round, sport: 'Judo',
      matchFormat: 'SINGLES', setScores: scores})).toBeFalse();
    expect(recordedRacketMatch({...round, matchFormat:'SINGLES',
      setScores: scores})).toBeTrue();
  });
});
