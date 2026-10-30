import { eventOptionsForSport, eventPresentationFormat, isNeutralEvent } from './community-round-event-type';
import { isTeamFinalEvent, teamFinalError, recordedTeamFinal, teamFinalWinner,
  teamFinalUsesGoals, teamFinalTitleKey, iceHockeyEvent, teamFinalHintKey,
  teamFinalUsesRuns, teamFinalScoreLabelKey, teamFinalIsDecisiveGoalEvent,
  teamFinalIsFootballPointsEvent, teamFinalPetanqueTarget, teamFinalMaxScore,
  teamFinalSideLabelKey } from './community-team-final-results';

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
  it('separates Curling regulation and extra ends, permitting multi-point extra-end margins',()=>{
    expect(eventOptionsForSport('Curling').map(x=>x.code)).toEqual(['CURLING_REG','CURLING_EXTRA']);
    for (const type of ['CURLING_REG','CURLING_EXTRA']) {
      expect(type.length).toBeLessThanOrEqual(20);
      expect(isNeutralEvent('Curling',type)).toBeTrue();
      expect(isTeamFinalEvent(type)).toBeTrue();
      expect(teamFinalUsesGoals(type)).toBeFalse();
      expect(teamFinalScoreLabelKey(type)).toBe('communities.teamFinal.points');
      expect(eventPresentationFormat('Curling',type)).toBe('team');
      expect(teamFinalHintKey(type)).toContain('curling');
      expect(teamFinalMaxScore(type)).toBe(999);
      expect(teamFinalError(type,sides,score(7,5))).toBeNull();
    }
    expect(teamFinalError('CURLING_REG',sides,score(5,5))).toBeNull();
    expect(teamFinalError('CURLING_EXTRA',sides,score(5,5))).toBe('curlingExtraInvalidResult');
    expect(teamFinalError('CURLING_EXTRA',sides,score(9,6))).toBeNull();
    expect(teamFinalError('CURLING_EXTRA',sides,score(-1,6))).toBe('teamFinalInvalidScore');
    expect(teamFinalTitleKey('CURLING_REG')).toBe('communities.teamFinal.curlingReg');
    expect(teamFinalTitleKey('CURLING_EXTRA')).toBe('communities.teamFinal.curlingExtra');
    expect(recordedTeamFinal({eventType:'CURLING_EXTRA',teamScore:score(9,6)})).toBeTrue();
    expect(teamFinalWinner(score(5,5))).toBeNull();
  });
  it('enforces Petanca 13 and qualifying 11 targets and 1v1/2v2/3v3 roster',()=>{
    expect(eventOptionsForSport('Petanca').map(x=>x.code)).toEqual(['PETANQUE_13','PETANQUE_11']);
    for (const target of [13,11]) {
      const type='PETANQUE_'+target;
      expect(type.length).toBeLessThanOrEqual(20);
      expect(teamFinalPetanqueTarget(type)).toBe(target);
      expect(teamFinalMaxScore(type)).toBe(target);
      expect(teamFinalUsesGoals(type)).toBeFalse();
      expect(isTeamFinalEvent(type)).toBeTrue();
      expect(isNeutralEvent('Petanca',type)).toBeTrue();
      expect(eventPresentationFormat('Petanca',type)).toBe('team');
      expect(teamFinalScoreLabelKey(type)).toBe('communities.teamFinal.points');
      expect(teamFinalTitleKey(type)).toBe('communities.teamFinal.petanque'+target);
      expect(teamFinalError(type,sides,score(target,0))).toBeNull();
      expect(teamFinalError(type,sides,score(7,target))).toBeNull();
      for (const bad of [score(0,0),score(7,6),score(target,target),
        score(target+1,0),score(target-1,target-1)])
        expect(teamFinalError(type,sides,bad)).toBe('petanqueInvalidResult');
      for (const count of [2,3]) {
        const roster=Array.from({length:count},(_,i)=>[{team:'A'},{team:'B'}]).flat();
        expect(teamFinalError(type,roster,score(target,4))).toBeNull();
      }
      expect(teamFinalError(type,[{team:'A'},{team:'A'},{team:'B'}],score(target,4)))
        .toBe('petanqueInvalidTeams');
      expect(teamFinalError(type,[{team:'A'},{team:'A'},{team:'A'},{team:'A'},
        {team:'B'},{team:'B'},{team:'B'},{team:'B'}],score(target,4)))
        .toBe('petanqueInvalidTeams');
    }
    expect(teamFinalPetanqueTarget('RUGBY_FINAL')).toBeNull();
    expect(teamFinalMaxScore('RUGBY_FINAL')).toBe(999);
    expect(eventOptionsForSport('Futebol')).toEqual([]);
    expect(teamFinalError('PETANQUE_13',[{team:'A'}],score(13,0))).toBe('teamFinalInvalidTeams');
  });
  it('models one confirmed tenpin Bowling game, not invented frames',()=>{
    const type='BOWLING_TENPIN';
    expect(type.length).toBeLessThanOrEqual(20);
    expect(eventOptionsForSport('Bowling').map(x=>x.code)).toEqual([type]);
    expect(isTeamFinalEvent(type)).toBeTrue();
    expect(isNeutralEvent('Bowling',type)).toBeTrue();
    expect(eventPresentationFormat('Bowling',type)).toBe('team');
    expect(teamFinalUsesGoals(type)).toBeFalse();
    expect(teamFinalUsesRuns(type)).toBeFalse();
    expect(teamFinalScoreLabelKey(type)).toBe('communities.teamFinal.points');
    expect(teamFinalMaxScore(type)).toBe(300);
    expect(teamFinalTitleKey(type)).toBe('communities.teamFinal.bowlingTenpin');
    expect(teamFinalHintKey(type)).toBe('communities.teamFinal.bowlingTenpinHint');
    for (const result of [score(0,0),score(300,300),score(221,190),score(100,200)])
      expect(teamFinalError(type,sides,result)).toBeNull();
    expect(teamFinalError(type,sides,score(301,0))).toBe('bowlingInvalidScore');
    expect(teamFinalError(type,sides,score(0,301))).toBe('bowlingInvalidScore');
    expect(teamFinalError(type,sides,score(-1,0))).toBe('teamFinalInvalidScore');
    expect(teamFinalError(type,[{team:'A'},{team:'A'},{team:'B'}],score(150,100)))
      .toBe('teamFinalSinglesRequired');
    expect(recordedTeamFinal({eventType:type,teamScore:score(0,0)})).toBeTrue();
    expect(teamFinalWinner(score(200,200))).toBeNull();
  });
  it('records singles nine-ball Pool rack wins without claiming a race length',()=>{
    const type='POOL_9_RACKS';
    expect(type.length).toBeLessThanOrEqual(20);
    expect(eventOptionsForSport('Bilhar').map(x=>x.code)).toEqual([type]);
    expect(isTeamFinalEvent(type)).toBeTrue();
    expect(isNeutralEvent('Bilhar',type)).toBeTrue();
    expect(eventPresentationFormat('Bilhar',type)).toBe('team');
    expect(teamFinalUsesGoals(type)).toBeFalse();
    expect(teamFinalUsesRuns(type)).toBeFalse();
    expect(teamFinalScoreLabelKey(type)).toBe('communities.teamFinal.racksWon');
    expect(teamFinalMaxScore(type)).toBe(999);
    expect(teamFinalHintKey(type)).toBe('communities.teamFinal.poolNineBallHint');
    for (const result of [score(1,0),score(9,6),score(7,10),score(11,10)])
      expect(teamFinalError(type,sides,result)).toBeNull();
    for (const result of [score(0,0),score(1,1),score(9,9)])
      expect(teamFinalError(type,sides,result)).toBe('poolNineBallInvalidScore');
    expect(teamFinalError(type,sides,score(-1,2))).toBe('teamFinalInvalidScore');
    expect(teamFinalError(type,sides,score(1000,2))).toBe('teamFinalInvalidScore');
    expect(teamFinalError(type,[{team:'A'},{team:'A'},{team:'B'}],score(5,3)))
      .toBe('teamFinalSinglesRequired');
    expect(recordedTeamFinal({eventType:type,teamScore:score(9,6)})).toBeTrue();
    expect(teamFinalWinner(score(9,6))).toBe('A');
    expect(teamFinalWinner(score(7,9))).toBe('B');
    expect(eventOptionsForSport('Futebol')).toEqual([]);
    expect(teamFinalScoreLabelKey('CURLING_EXTRA')).toBe('communities.teamFinal.points');
  });
  it('labels singles as players while preserving team labels',()=>{
    for (const type of ['BOWLING_TENPIN','POOL_9_RACKS']) {
      expect(teamFinalSideLabelKey(type,'A')).toBe('communities.teamFinal.playerA');
      expect(teamFinalSideLabelKey(type,'B')).toBe('communities.teamFinal.playerB');
    }
    for (const type of ['RUGBY_FINAL','CURLING_REG','PETANQUE_13','FUTSAL_FINAL']) {
      expect(teamFinalSideLabelKey(type,'A')).toBe('communities.teamFinal.sideA');
      expect(teamFinalSideLabelKey(type,'B')).toBe('communities.teamFinal.sideB');
    }
  });
  it('enforces individual Fencing pool 5 and elimination 15 touch limits',()=>{
    for(const [type,max,key] of [
      ['FENCING_POOL_5',5,'fencingPool'],
      ['FENCING_DE_15',15,'fencingElimination']
    ] as const){
      expect(type.length).toBeLessThanOrEqual(20);
      expect(eventOptionsForSport('Esgrima').map(x=>x.code)).toContain(type);
      expect(eventPresentationFormat('Esgrima',type)).toBe('team');
      expect(isNeutralEvent('Esgrima',type)).toBeTrue();
      expect(isTeamFinalEvent(type)).toBeTrue();
      expect(teamFinalUsesGoals(type)).toBeFalse();
      expect(teamFinalScoreLabelKey(type)).toBe('communities.teamFinal.touches');
      expect(teamFinalTitleKey(type)).toBe('communities.teamFinal.'+key);
      expect(teamFinalHintKey(type)).toBe('communities.teamFinal.'+key+'Hint');
      expect(teamFinalMaxScore(type)).toBe(max);
      expect(teamFinalSideLabelKey(type,'A')).toBe('communities.teamFinal.playerA');
      expect(teamFinalSideLabelKey(type,'B')).toBe('communities.teamFinal.playerB');
      for(const points of [score(max,0),score(max,max-1),score(3,2),score(0,1)])
        expect(teamFinalError(type,sides,points)).toBeNull();
      for(const points of [score(max+1,0),score(0,max+1)])
        expect(teamFinalError(type,sides,points)).toBe('fencingInvalidScore');
      for(const points of [score(0,0),score(4,4)])
        expect(teamFinalError(type,sides,points)).toBe('fencingPriorityUnsupported');
      expect(teamFinalError(type,[{team:'A'},{team:'A'},{team:'B'}],score(max,2)))
        .toBe('teamFinalSinglesRequired');
    }
    expect(eventOptionsForSport('Teqball').map(x=>x.code)).toEqual(['TEQBALL_SINGLES','TEQBALL_DOUBLES']);
    expect(eventOptionsForSport('Futebol')).toEqual([]);
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
