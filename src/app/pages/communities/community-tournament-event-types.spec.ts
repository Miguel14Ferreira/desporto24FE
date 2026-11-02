import { SPORTS_CATALOG } from '../../shared/sports-catalog';
import { tournamentSportCapabilities } from './community-tournament-capabilities';
import { tournamentEventChoices, validatedTournamentEventType } from './community-tournament-event-types';

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
    expect(validatedTournamentEventType('Atletismo','TRACK_BEST_TIME','TRACK')).toBe('TRACK');
  });
  it('does not turn freestyle, swimming, athletics or golf into generic race standings',()=>{
    for(const [sport,code] of [['BMX','FREESTYLE'],['Atletismo','TRACK'],['Natação','SWIM_LCM'],['Golfe','GOLF_STROKE_18'],['Snowboard','RACE']])
      expect(validatedTournamentEventType(sport,'RACE_POINTS',code)).toBeNull();
    expect(validatedTournamentEventType('Futebol','NUMERIC_TEAM','RACE')).toBeNull();
    expect(validatedTournamentEventType('BMX','RACE_POINTS',null)).toBeNull();
    expect(validatedTournamentEventType('Natação','RACE_POINTS','SWIM_LCM')).toBeNull();
  });
});
