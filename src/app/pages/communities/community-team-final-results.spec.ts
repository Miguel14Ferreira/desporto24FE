import { eventOptionsForSport, eventPresentationFormat, isNeutralEvent } from './community-round-event-type';
import { isTeamFinalEvent, teamFinalError, recordedTeamFinal, teamFinalWinner,
  teamFinalUsesGoals, teamFinalTitleKey } from './community-team-final-results';

describe('handball rugby and sevens final team scores', () => {
  const sides=[{team:'A'},{team:'B'}];
  const score=(sideA:number,sideB:number)=>({sideA,sideB});
  it('defines neutral typed team events and preserves football',()=>{
    for(const [sport,type] of [['Andebol','HANDBALL_FINAL'],['Rugby','RUGBY_FINAL'],['Rugby Sevens','RUGBY_SEVENS_FINAL']]){
      expect(eventOptionsForSport(sport).map(x=>x.code)).toEqual([type as any]);
      expect(isNeutralEvent(sport,type)).toBeTrue();
      expect(eventPresentationFormat(sport,type)).toBe('team');
      expect(isTeamFinalEvent(type)).toBeTrue();
    }
    expect(eventOptionsForSport('Futebol')).toEqual([]);
  });
  it('permits draws and winners, without fabricated individual points',()=>{
    for(const type of ['HANDBALL_FINAL','RUGBY_FINAL','RUGBY_SEVENS_FINAL']){
      expect(teamFinalError(type,sides,score(0,0))).toBeNull();
      expect(teamFinalError(type,sides,score(26,26))).toBeNull();
      expect(teamFinalError(type,sides,score(26,25))).toBeNull();
    }
    expect(teamFinalWinner(score(3,3))).toBeNull();
    expect(teamFinalWinner(score(4,3))).toBe('A');
    expect(teamFinalWinner(score(3,4))).toBe('B');
    expect(recordedTeamFinal({eventType:'RUGBY_FINAL',teamScore:score(0,0)})).toBeTrue();
  });
  it('supports futsal, field hockey, roller hockey and water polo goals without rewriting rugby points',()=>{
    const supported: Array<[string,string,string]> = [
      ['Futsal','FUTSAL_FINAL','futsal'],
      ['Hóquei em Campo','FIELD_HOCKEY_FINAL','fieldHockey'],
      ['Hóquei em Patins','ROLLER_HOCKEY_FINAL','rollerHockey'],
      ['Polo Aquático','WATER_POLO_FINAL','waterPolo']
    ];
    for (const [sport,type,key] of supported) {
      expect(eventOptionsForSport(sport).map(x=>x.code)).toEqual([type as any]);
      expect(isTeamFinalEvent(type)).toBeTrue();
      expect(isNeutralEvent(sport,type)).toBeTrue();
      expect(eventPresentationFormat(sport,type)).toBe('team');
      expect(teamFinalUsesGoals(type)).toBeTrue();
      expect(teamFinalTitleKey(type)).toBe('communities.teamFinal.'+key);
      expect(teamFinalError(type,sides,score(0,0))).toBeNull();
      expect(teamFinalError(type,sides,score(5,3))).toBeNull();
      expect(teamFinalError(type,sides,score(2,2))).toBeNull();
      expect(recordedTeamFinal({eventType:type as any,teamScore:score(5,3)})).toBeTrue();
      expect(teamFinalError(type,sides,score(1000,0))).toBe('teamFinalInvalidScore');
    }
    expect(teamFinalUsesGoals('HANDBALL_FINAL')).toBeTrue();
    expect(teamFinalUsesGoals('RUGBY_FINAL')).toBeFalse();
    expect(teamFinalUsesGoals('RUGBY_SEVENS_FINAL')).toBeFalse();
    expect(eventOptionsForSport('Hóquei no Gelo')).toEqual([]);
    expect(teamFinalTitleKey('RUGBY_FINAL')).toBe('communities.teamFinal.rugby');
  });
  it('rejects invalid scores and incomplete team assignments',()=>{
    expect(teamFinalError('RUGBY_FINAL',sides,score(1000,0))).toBe('teamFinalInvalidScore');
    expect(teamFinalError('RUGBY_FINAL',sides,score(-1,0))).toBe('teamFinalInvalidScore');
    expect(teamFinalError('RUGBY_FINAL',sides,score(1.5,0))).toBe('teamFinalInvalidScore');
    expect(teamFinalError('HANDBALL_FINAL',[{team:'A'}],score(2,0))).toBe('teamFinalInvalidTeams');
    expect(teamFinalError('HANDBALL_FINAL',[{team:'A'},{team:'C'}],score(2,0))).toBe('teamFinalInvalidTeams');
    expect(teamFinalError('VOLLEYBALL_FINAL',sides,score(2,0))).toBe('teamFinalInvalidScore');
  });
});
