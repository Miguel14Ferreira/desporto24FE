import {
  isGroupRoutineEvent, routineGroupError, routineGroupNames,
  sortedRoutineGroups, routineGroupPlace, routineGroupMembers
} from './community-group-routine-results';
import { CommunityRound } from '../model/community-group';

const people = (name: string, count: number) =>
  Array.from({length: count}, (_, i) =>
    ({ team:name, performanceValue: null, username: name + i }));
const mark = (groupName: string, score: number | null) => ({groupName,score});

describe('one shared score per performing group', () => {
  it('distinguishes duet, team, rhythmic and historical individual entries', () => {
    expect(isGroupRoutineEvent('ARTISTIC_DUET_TECH')).toBeTrue();
    expect(isGroupRoutineEvent('ARTISTIC_TEAM_FREE')).toBeTrue();
    expect(isGroupRoutineEvent('RHYTHMIC_GROUP_3_2')).toBeTrue();
    expect(isGroupRoutineEvent('ARTISTIC_SOLO_FREE')).toBeFalse();
    expect(routineGroupNames([...people('A',2), ...people('a',2), ...people('B',4)]))
      .toEqual(['A','B']);
  });
  it('requires 2 members per duet and 4–8 per team', () => {
    expect(routineGroupError('ARTISTIC_DUET_FREE',people('A',2),[mark('A',210.1234)])).toBeNull();
    expect(routineGroupError('ARTISTIC_DUET_FREE',people('A',3),[mark('A',30)]))
      .toBe('groupRoutineSizeInvalid');
    expect(routineGroupError('ARTISTIC_TEAM_TECH',people('A',4),[mark('A',200)])).toBeNull();
    expect(routineGroupError('ARTISTIC_TEAM_TECH',people('A',8),[mark('A',200)])).toBeNull();
    expect(routineGroupError('ARTISTIC_TEAM_TECH',people('A',9),[mark('A',200)]))
      .toBe('groupRoutineSizeInvalid');
  });
  it('rhythmic routines need five; never attach a score to an athlete', () => {
    expect(routineGroupError('RHYTHMIC_GROUP_5',people('Conjunto',5),[mark('Conjunto',35.125)])).toBeNull();
    expect(routineGroupError('RHYTHMIC_GROUP_3_2',people('Conjunto',4),[mark('Conjunto',35)]))
      .toBe('groupRoutineSizeInvalid');
    expect(routineGroupError('RHYTHMIC_GROUP_5',people('Conjunto',5),[mark('Conjunto',35.1234)]))
      .toBe('groupRoutineScoreInvalid');
    expect(routineGroupError('ARTISTIC_DUET_TECH',
      [{team:'A',performanceValue:12},{team:'A',performanceValue:null}],[mark('A',210)]))
      .toBe('groupRoutineInvalid');
  });
  it('rejects duplicate/missing marks and respects four-decimal precision', () => {
    const entries=[...people('A',2),...people('B',2)];
    expect(routineGroupError('ARTISTIC_DUET_TECH',entries,
      [mark('A',80),mark('a',90)])).toBe('groupRoutineInvalid');
    expect(routineGroupError('ARTISTIC_DUET_TECH',entries,
      [mark('A',80)])).toBe('groupRoutineInvalid');
    expect(routineGroupError('ARTISTIC_DUET_TECH',entries,
      [mark('A',180.12345),mark('B',170.1)])).toBe('groupRoutineScoreInvalid');
    expect(routineGroupError('ARTISTIC_DUET_TECH',entries,
      [mark('A',180.1234),mark('B',null)])).toBeNull();
  });
  it('ranks ONLY one routine, with ties and unscored groups last', () => {
    const round={
      groupScores:[mark('A',210.125),mark('C',null),mark('B',210.125),mark('D',180)],
      entries:[{team:'A',fullName:'Ana'},{team:'A',fullName:'Inês'},
        {team:'B',fullName:'Bruna'}]
    } as CommunityRound;
    const sorted=sortedRoutineGroups(round);
    expect(sorted.map(g=>g.groupName)).toEqual(['A','B','D','C']);
    expect(routineGroupPlace(sorted,sorted[0])).toBe(1);
    expect(routineGroupPlace(sorted,sorted[1])).toBe(1);
    expect(routineGroupPlace(sorted,sorted[2])).toBe(3);
    expect(routineGroupPlace(sorted,sorted[3])).toBeNull();
    expect(routineGroupMembers(round,'a')).toEqual(['Ana','Inês']);
  });
});
