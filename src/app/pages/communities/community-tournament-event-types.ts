import { TournamentCreationModel } from './community-tournament-capabilities';

/** Only types with compatible tournament result contracts may be persisted. */
export interface TournamentEventChoice {
  code: string;
  supported: boolean;
}
const CHOICES: Record<string, readonly string[]> = {
  BMX: ['RACE','FREESTYLE'],
  'Ciclismo de Estrada': ['ROAD_RACE','TIME_TRIAL'],
  'Ciclismo de Pista': ['TRACK_SCRATCH','TRACK_TIME_TRIAL','TRACK_SPRINT_HEAT'],
  Xadrez: ['CHESS_GAME'],
  Atletismo: ['TRACK','JUMP','THROW'],
  'Natação': ['SWIM_LCM'],
  Snowboard: ['RACE','FREESTYLE'],
  Golfe: ['GOLF_STROKE_9','GOLF_STROKE_18'],
  Surf: ['HEAT'],
  Skate: ['SKATE_PARK','SKATE_STREET'],
  Parkour: ['PARKOUR_SPEED','PARKOUR_FREESTYLE']
};
const COMPATIBLE: Record<string,{code:string; model:TournamentCreationModel}> = {
  BMX: {code:'RACE',model:'RACE_POINTS'},
  'Ciclismo de Estrada': {code:'ROAD_RACE',model:'RACE_POINTS'},
  'Ciclismo de Pista': {code:'TRACK_SCRATCH',model:'RACE_POINTS'},
  Xadrez: {code:'CHESS_GAME',model:'NUMERIC_INDIVIDUAL'}
};
export function tournamentEventChoices(sport: string, model: TournamentCreationModel): TournamentEventChoice[] {
  return (CHOICES[sport]??[]).map(code=>({
    code, supported:COMPATIBLE[sport]?.code===code && COMPATIBLE[sport]?.model===model
  }));
}
export function validatedTournamentEventType(sport:string,model:TournamentCreationModel,code:string|null|undefined):string|null{
  if(!code)return null;
  return tournamentEventChoices(sport,model).find(x=>x.code===code && x.supported)?.code ?? null;
}
