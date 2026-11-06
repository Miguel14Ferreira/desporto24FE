import { SPORTS_CATALOG } from '../../shared/sports-catalog';
import { tournamentSportCapabilities } from './community-tournament-capabilities';
import { tournamentEventChoices, validatedTournamentEventType, tournamentEventReadiness, validCanoeDiscipline, validRowingDiscipline, validFieldTournamentDiscipline } from './community-tournament-event-types';

describe('Sport-specific tournament event types',()=>{
  it('maps all 121 catalog sports without invented event fallbacks',()=>{
    expect(SPORTS_CATALOG.length).toBe(121);
    for(const sport of SPORTS_CATALOG){
      const caps=tournamentSportCapabilities(sport);
      for(const model of [caps.individual,caps.team]){
        const options=tournamentEventChoices(sport,model);
        expect(new Set(options.map(x=>x.code)).size).withContext(sport).toBe(options.length);
        for(const option of options)
          expect(validatedTournamentEventType(sport,model,option.code))
            .withContext(sport+'/'+option.code).toBe(option.supported?option.code:null);
      }
    }
  });
  it('isolates rowing 1x distances and rejects crew boats and points',()=>{
    expect(validatedTournamentEventType('Remo','ROWING_BEST_TIME','ROWING_SINGLE')).toBe('ROWING_SINGLE');
    expect(validatedTournamentEventType('Remo','RACE_POINTS','ROWING_SINGLE')).toBeNull();
    for(const code of ['SINGLE_500','SINGLE_1000','SINGLE_2000'])
      expect(validRowingDiscipline('ROWING_SINGLE',code)).toBeTrue();
    for(const code of ['DOUBLE_2000','K1_500',null])
      expect(validRowingDiscipline('ROWING_SINGLE',code)).toBeFalse();
  });
  it('allows only one exact canoe sprint timed contract per K1 distance',()=>{
    expect(validatedTournamentEventType('Canoagem Velocidade','CANOE_BEST_TIME','CANOE_SPRINT'))
      .toBe('CANOE_SPRINT');
    expect(validatedTournamentEventType('Canoagem Velocidade','RACE_POINTS','CANOE_SPRINT')).toBeNull();
    expect(validCanoeDiscipline('CANOE_SPRINT','K1_200')).toBeTrue();
    expect(validCanoeDiscipline('CANOE_SPRINT','K1_500')).toBeTrue();
    expect(validCanoeDiscipline('CANOE_SPRINT','K1_1000')).toBeTrue();
    expect(validCanoeDiscipline('CANOE_SPRINT','K2_500')).toBeFalse();
    expect(validCanoeDiscipline('CANOE_SPRINT',null)).toBeFalse();
  });
  it('allows only race-position and individual chess types with matching scoring',()=>{
    for(const [sport,code] of [['BMX','RACE'],['Ciclismo de Estrada','ROAD_RACE'],['Ciclismo de Pista','TRACK_SCRATCH']]){
      expect(validatedTournamentEventType(sport,'RACE_POINTS',code)).toBe(code);
      expect(validatedTournamentEventType(sport,'NUMERIC_TEAM',code)).toBeNull();
    }
    expect(validatedTournamentEventType('Xadrez','NUMERIC_INDIVIDUAL','CHESS_GAME')).toBe('CHESS_GAME');
    expect(validatedTournamentEventType('Natação','SWIM_BEST_TIME','SWIM_LCM')).toBe('SWIM_LCM');
    expect(validatedTournamentEventType('Atletismo','FIELD_BEST_MARK','JUMP')).toBe('JUMP');
    expect(validatedTournamentEventType('Atletismo','FIELD_BEST_MARK','THROW')).toBe('THROW');
    expect(validatedTournamentEventType('Atletismo','FIELD_BEST_MARK','TRACK')).toBe('TRACK');
    expect(validatedTournamentEventType('Atletismo','TRACK_BEST_TIME','JUMP')).toBe('JUMP');
    expect(validatedTournamentEventType('Atletismo','TRACK_BEST_TIME','THROW')).toBe('THROW');
    expect(validatedTournamentEventType('Atletismo','FIELD_BEST_MARK','TRACK_RELAY')).toBeNull();
    expect(validatedTournamentEventType('Atletismo','TRACK_BEST_TIME','TRACK')).toBe('TRACK');
    expect(validatedTournamentEventType('Atletismo','RELAY_BEST_TIME','TRACK_RELAY')).toBe('TRACK_RELAY');
    expect(validatedTournamentEventType('Atletismo','RELAY_BEST_TIME','TRACK')).toBeNull();
  });
  it('does not turn freestyle, swimming, athletics or golf into generic race standings',()=>{
    for(const [sport,code] of [['BMX','FREESTYLE'],['Atletismo','TRACK'],['Natação','SWIM_LCM'],['Golfe','GOLF_STROKE_18'],['Snowboard','RACE']])
      expect(validatedTournamentEventType(sport,'RACE_POINTS',code)).toBeNull();
    expect(validatedTournamentEventType('Futebol','NUMERIC_TEAM','RACE')).toBeNull();
    expect(validatedTournamentEventType('BMX','RACE_POINTS',null)).toBeNull();
    expect(validatedTournamentEventType('Natação','RACE_POINTS','SWIM_LCM')).toBeNull();
  });

  it('validates each specialist engine with its own event and discipline', () => {
    const cases = [
      ['SWIM_BEST_TIME', 'SWIM_LCM', 'FREE_50'],
      ['CANOE_BEST_TIME', 'CANOE_SPRINT', 'K1_500'],
      ['ROWING_BEST_TIME', 'ROWING_SINGLE', 'SINGLE_2000'],
      ['FIELD_BEST_MARK', 'JUMP', 'LONG_JUMP'],
      ['FIELD_BEST_MARK', 'THROW', 'JAVELIN'],
      ['TRACK_BEST_TIME', 'TRACK', 'TRACK_100'],
      ['RELAY_BEST_TIME', 'TRACK_RELAY', 'RELAY_4X400']
    ] as const;
    for (const [model, event, discipline] of cases) {
      expect(tournamentEventReadiness(model, event, discipline, 'LEAGUE'))
        .withContext(model).toBe('READY');
      expect(tournamentEventReadiness(model, null, discipline, 'LEAGUE'))
        .withContext(model).toBe('EVENT_REQUIRED');
      expect(tournamentEventReadiness(model, event, null, 'LEAGUE'))
        .withContext(model).toBe('DISCIPLINE_REQUIRED');
      expect(tournamentEventReadiness(model, event, 'INVALID', 'LEAGUE'))
        .withContext(model).toBe('DISCIPLINE_REQUIRED');
    }
  });

  it('never permits a discipline from another athletics event or team engine', () => {
    expect(tournamentEventReadiness('TRACK_BEST_TIME', 'TRACK', 'LONG_JUMP', 'LEAGUE'))
      .toBe('DISCIPLINE_REQUIRED');
    expect(tournamentEventReadiness('FIELD_BEST_MARK', 'JUMP', 'TRACK_100', 'LEAGUE'))
      .toBe('DISCIPLINE_REQUIRED');
    expect(tournamentEventReadiness('FIELD_BEST_MARK', 'THROW', 'LONG_JUMP', 'LEAGUE'))
      .toBe('DISCIPLINE_REQUIRED');
    expect(tournamentEventReadiness('RELAY_BEST_TIME', 'TRACK_RELAY', 'RELAY_4X100', 'KNOCKOUT'))
      .toBe('LEAGUE_REQUIRED');
    expect(tournamentEventReadiness('RELAY_BEST_TIME', null, null, 'KNOCKOUT'))
      .toBe('LEAGUE_REQUIRED');
    expect(tournamentEventReadiness('UNAVAILABLE', null, null, 'LEAGUE'))
      .toBe('UNAVAILABLE');
    // Legacy numeric/race APIs continue to accept optional event metadata.
    expect(tournamentEventReadiness('RACE_POINTS', null, null, 'LEAGUE')).toBe('READY');
    expect(tournamentEventReadiness('NUMERIC_TEAM', null, null, 'KNOCKOUT')).toBe('READY');
  });


  it('rejects unknown and inherited object keys without throwing or creating fake events', () => {
    for (const sport of ['__proto__', 'constructor', 'toString', 'hasOwnProperty', 'Unknown sport']) {
      expect(tournamentEventChoices(sport, 'NUMERIC_INDIVIDUAL')).withContext(sport).toEqual([]);
      expect(validatedTournamentEventType(sport, 'NUMERIC_INDIVIDUAL', 'TRACK'))
        .withContext(sport).toBeNull();
    }
    for (const event of ['__proto__', 'constructor', 'toString', 'hasOwnProperty']) {
      expect(validFieldTournamentDiscipline(event, 'LONG_JUMP')).withContext(event).toBeFalse();
      expect(tournamentEventReadiness('FIELD_BEST_MARK', event, 'LONG_JUMP', 'LEAGUE'))
        .withContext(event).toBe('DISCIPLINE_REQUIRED');
    }
    expect(validFieldTournamentDiscipline('JUMP', 'LONG_JUMP')).toBeTrue();
    expect(validFieldTournamentDiscipline('THROW', 'JAVELIN')).toBeTrue();
  });

});
