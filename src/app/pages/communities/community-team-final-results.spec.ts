import { eventOptionsForSport, eventPresentationFormat, isNeutralEvent } from './community-round-event-type';
import { isTeamFinalEvent, teamFinalError, recordedTeamFinal, teamFinalWinner,
  teamFinalUsesGoals, teamFinalTitleKey, iceHockeyEvent, teamFinalHintKey,
  teamFinalUsesRuns, teamFinalScoreLabelKey, teamFinalIsDecisiveGoalEvent,
  teamFinalIsFootballPointsEvent } from './community-team-final-results';

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
    expect(eventOptionsForSport('Hóquei no Gelo').map(x=>x.code)).toEqual([
      'ICE_HOCKEY_REG','ICE_HOCKEY_OT','ICE_HOCKEY_SO']);
    expect(teamFinalTitleKey('RUGBY_FINAL')).toBe('communities.teamFinal.rugby');
  });
  it('distinguishes regulation, overtime and shootout scores in ice hockey',()=>{
    const events=['ICE_HOCKEY_REG','ICE_HOCKEY_OT','ICE_HOCKEY_SO'];
    expect(eventOptionsForSport('Hóquei no Gelo').map(x=>x.code)).toEqual(events as any);
    for(const type of events){
      expect(type.length).toBeLessThanOrEqual(20);
      expect(iceHockeyEvent(type)).toBeTrue();
      expect(isTeamFinalEvent(type)).toBeTrue();
      expect(teamFinalUsesGoals(type)).toBeTrue();
      expect(isNeutralEvent('Hóquei no Gelo',type)).toBeTrue();
      expect(eventPresentationFormat('Hóquei no Gelo',type)).toBe('team');
      expect(teamFinalHintKey(type)).toContain('iceHockey');
    }
    expect(teamFinalTitleKey('ICE_HOCKEY_REG')).toBe('communities.teamFinal.iceRegulation');
    expect(teamFinalTitleKey('ICE_HOCKEY_OT')).toBe('communities.teamFinal.iceOvertime');
    expect(teamFinalTitleKey('ICE_HOCKEY_SO')).toBe('communities.teamFinal.iceShootout');
    expect(teamFinalError('ICE_HOCKEY_REG',sides,score(2,2))).toBeNull();
    expect(teamFinalError('ICE_HOCKEY_REG',sides,score(4,2))).toBeNull();
    for (const type of ['ICE_HOCKEY_OT','ICE_HOCKEY_SO']) {
      expect(teamFinalError(type,sides,score(3,2))).toBeNull();
      expect(teamFinalError(type,sides,score(0,1))).toBeNull();
      expect(teamFinalError(type,sides,score(2,2))).toBe('iceHockeyInvalidDecision');
      expect(teamFinalError(type,sides,score(5,2))).toBe('iceHockeyInvalidDecision');
      expect(teamFinalError(type,[{team:'A'}],score(3,2))).toBe('teamFinalInvalidTeams');
    }
    expect(eventOptionsForSport('Hóquei')).toEqual([]);
    expect(eventOptionsForSport('Hóquei em Campo').map(x=>x.code)).toEqual(['FIELD_HOCKEY_FINAL']);
    expect(teamFinalHintKey('RUGBY_FINAL')).toBe('communities.teamFinal.finalHint');
  });
  it('supports Basebol and Softbol with registered runs, without fictional innings or standings',()=>{
    for (const [sport,type,titleKey] of [
      ['Basebol','BASEBALL_RUNS','baseballRuns'],
      ['Softbol','SOFTBALL_RUNS','softballRuns']
    ]) {
      expect(type.length).toBeLessThanOrEqual(20);
      expect(eventOptionsForSport(sport).map(x=>x.code)).toEqual([type as any]);
      expect(isTeamFinalEvent(type)).toBeTrue();
      expect(isNeutralEvent(sport,type)).toBeTrue();
      expect(eventPresentationFormat(sport,type)).toBe('team');
      expect(teamFinalUsesRuns(type)).toBeTrue();
      expect(teamFinalUsesGoals(type)).toBeFalse();
      expect(teamFinalScoreLabelKey(type)).toBe('communities.teamFinal.runs');
      expect(teamFinalTitleKey(type)).toBe('communities.teamFinal.'+titleKey);
      expect(teamFinalHintKey(type)).toContain('RunsHint');
      for (const result of [score(0,0),score(7,4),score(3,12),score(5,5)]) {
        expect(teamFinalError(type,sides,result)).toBeNull();
      }
      expect(recordedTeamFinal({eventType:type as any,teamScore:score(0,0)})).toBeTrue();
      expect(teamFinalError(type,sides,score(-1,2))).toBe('teamFinalInvalidScore');
      expect(teamFinalError(type,sides,score(1000,0))).toBe('teamFinalInvalidScore');
      expect(teamFinalError(type,[{team:'A'}],score(2,1))).toBe('teamFinalInvalidTeams');
      expect(teamFinalError(type,[{team:'A',performanceValue:2},{team:'B'}],score(2,1)))
        .toBe('teamFinalInvalidTeams');
    }
    expect(eventOptionsForSport('Futebol')).toEqual([]);
    expect(eventOptionsForSport('Lacrosse').map(x=>x.code)).toEqual(['LACROSSE_M_REG','LACROSSE_M_OT']);
    expect(eventOptionsForSport('Corfebol').map(x=>x.code)).toEqual(['KORFBALL_REG','KORFBALL_GOLDEN']);
    expect(teamFinalScoreLabelKey('FUTSAL_FINAL')).toBe('communities.teamFinal.goals');
    expect(teamFinalScoreLabelKey('RUGBY_FINAL')).toBe('communities.teamFinal.points');
  });
  it('registers only Corfebol and mens field Lacrosse goal formats',()=>{
    const supported: Array<[string,string,string,string]> = [
      ['Corfebol','KORFBALL_REG','KORFBALL_GOLDEN','korfball'],
      ['Lacrosse','LACROSSE_M_REG','LACROSSE_M_OT','lacrosseMen']
    ];
    for (const [sport,regular,decided,prefix] of supported) {
      expect(eventOptionsForSport(sport).map(x=>x.code)).toEqual([regular,decided] as any);
      for (const type of [regular,decided]) {
        expect(type.length).toBeLessThanOrEqual(20);
        expect(isTeamFinalEvent(type)).toBeTrue();
        expect(teamFinalUsesGoals(type)).toBeTrue();
        expect(isNeutralEvent(sport,type)).toBeTrue();
        expect(eventPresentationFormat(sport,type)).toBe('team');
        expect(teamFinalScoreLabelKey(type)).toBe('communities.teamFinal.goals');
        expect(teamFinalTitleKey(type)).toContain(prefix);
        expect(teamFinalHintKey(type)).toContain(prefix);
        expect(teamFinalError(type,sides,score(0,0))).toBe(type===decided?'teamFinalDecisiveGoalRequired':null);
      }
      expect(teamFinalIsDecisiveGoalEvent(regular)).toBeFalse();
      expect(teamFinalIsDecisiveGoalEvent(decided)).toBeTrue();
      expect(teamFinalError(regular,sides,score(11,11))).toBeNull();
      expect(teamFinalError(regular,sides,score(15,12))).toBeNull();
      expect(teamFinalError(decided,sides,score(12,11))).toBeNull();
      expect(teamFinalError(decided,sides,score(11,12))).toBeNull();
      expect(teamFinalError(decided,sides,score(11,11))).toBe('teamFinalDecisiveGoalRequired');
      expect(teamFinalError(decided,sides,score(11,13))).toBe('teamFinalDecisiveGoalRequired');
      expect(teamFinalError(regular,sides,score(1000,0))).toBe('teamFinalInvalidScore');
      expect(teamFinalError(decided,[{team:'A'}],score(12,11))).toBe('teamFinalInvalidTeams');
    }
    expect(eventOptionsForSport('Corfebol').map(x=>x.code)).not.toContain('LACROSSE_M_REG' as any);
    expect(eventOptionsForSport('Lacrosse').map(x=>x.code)).not.toContain('KORFBALL_REG' as any);
    expect(eventOptionsForSport('Futebol')).toEqual([]);
    expect(teamFinalIsDecisiveGoalEvent('ICE_HOCKEY_OT')).toBeTrue();
    expect(teamFinalIsDecisiveGoalEvent('ICE_HOCKEY_SO')).toBeTrue();
  });
  it('supports distinct American and Flag Football confirmed points without invented plays',()=>{
    const cases: Array<[string,string,string]> = [
      ['Futebol Americano','AMFOOTBALL_SCORE','americanFootball'],
      ['Flag Football','FLAGFOOTBALL_SCORE','flagFootball']
    ];
    for (const [sport,type,title] of cases) {
      expect(type.length).toBeLessThanOrEqual(20);
      expect(eventOptionsForSport(sport).map(x=>x.code)).toEqual([type] as any);
      expect(isTeamFinalEvent(type)).toBeTrue();
      expect(teamFinalIsFootballPointsEvent(type)).toBeTrue();
      expect(isNeutralEvent(sport,type)).toBeTrue();
      expect(eventPresentationFormat(sport,type)).toBe('team');
      expect(teamFinalUsesGoals(type)).toBeFalse();
      expect(teamFinalUsesRuns(type)).toBeFalse();
      expect(teamFinalScoreLabelKey(type)).toBe('communities.teamFinal.points');
      expect(teamFinalTitleKey(type)).toBe('communities.teamFinal.'+title);
      expect(teamFinalHintKey(type)).toBe('communities.teamFinal.'+title+'Hint');
      for(const pts of [score(0,0),score(7,6),score(21,14),score(32,32),score(41,35)]) {
        expect(teamFinalError(type,sides,pts)).toBeNull();
      }
      expect(recordedTeamFinal({eventType:type as any,teamScore:score(0,0)})).toBeTrue();
      expect(teamFinalError(type,sides,score(-1,3))).toBe('teamFinalInvalidScore');
      expect(teamFinalError(type,sides,score(1000,1))).toBe('teamFinalInvalidScore');
      expect(teamFinalError(type,[{team:'A'}],score(7,0))).toBe('teamFinalInvalidTeams');
    }
    expect(eventOptionsForSport('Futebol')).toEqual([]);
    expect(teamFinalIsFootballPointsEvent('RUGBY_FINAL')).toBeFalse();
    expect(teamFinalIsFootballPointsEvent('FUTSAL_FINAL')).toBeFalse();
    expect(teamFinalScoreLabelKey('RUGBY_SEVENS_FINAL')).toBe('communities.teamFinal.points');
    expect(teamFinalScoreLabelKey('BASEBALL_RUNS')).toBe('communities.teamFinal.runs');
    expect(teamFinalScoreLabelKey('KORFBALL_REG')).toBe('communities.teamFinal.goals');
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
