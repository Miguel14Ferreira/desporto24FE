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
  Xadrez: {code:'CHESS_GAME',model:'NUMERIC_INDIVIDUAL'},
  'Natação': {code:'SWIM_LCM',model:'SWIM_BEST_TIME'}
};
export function tournamentEventChoices(sport: string, model: TournamentCreationModel): TournamentEventChoice[] {
  return (CHOICES[sport]??[]).map(code=>({
    code, supported:(sport==='Atletismo' && model==='FIELD_BEST_MARK'
      && (code==='JUMP' || code==='THROW'))
      || (COMPATIBLE[sport]?.code===code && COMPATIBLE[sport]?.model===model)
  }));
}
export function validatedTournamentEventType(sport:string,model:TournamentCreationModel,code:string|null|undefined):string|null{
  if(!code)return null;
  return tournamentEventChoices(sport,model).find(x=>x.code===code && x.supported)?.code ?? null;
}

/** Exact, independently comparable 50m pool events validated by the backend. */
export const SWIM_TOURNAMENT_DISCIPLINES = [
  'FREE_50','FREE_100','FREE_200','BACK_100','BREAST_100','FLY_100','IM_200'
] as const;
export function validSwimTournamentDiscipline(eventType:string|null,discipline:string|null):boolean {
  return eventType==='SWIM_LCM'
    && SWIM_TOURNAMENT_DISCIPLINES.some(code=>code===discipline);
}

/** Exact and independently comparable field disciplines. */
export const FIELD_TOURNAMENT_DISCIPLINES: Readonly<Record<string, readonly string[]>> = {
  JUMP: ['LONG_JUMP','TRIPLE_JUMP','HIGH_JUMP','POLE_VAULT'],
  THROW: ['SHOT_PUT','DISCUS','JAVELIN','HAMMER']
};
export function validFieldTournamentDiscipline(eventType:string|null,discipline:string|null):boolean {
  return !!discipline && (FIELD_TOURNAMENT_DISCIPLINES[eventType ?? ''] ?? []).includes(discipline);
}
