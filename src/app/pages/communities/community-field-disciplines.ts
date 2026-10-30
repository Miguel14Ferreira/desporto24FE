/** Event discipline is descriptive; no automatic federation scoring or season points. */
export type AthleticsDiscipline = 'LONG_JUMP' | 'TRIPLE_JUMP' | 'HIGH_JUMP' | 'POLE_VAULT'
  | 'SHOT_PUT' | 'DISCUS' | 'JAVELIN' | 'HAMMER';

export type GymApparatus = 'FLOOR' | 'VAULT' | 'POMMEL_HORSE' | 'RINGS'
  | 'PARALLEL_BARS' | 'HORIZONTAL_BAR' | 'UNEVEN_BARS' | 'BALANCE_BEAM';
export type BodyboardStance = 'PRONE' | 'DROP_KNEE';
export type RhythmicApparatus = 'HOOP' | 'BALL' | 'CLUBS' | 'RIBBON';
export type OrienteeringCourse = 'ORIENT_SPRINT' | 'ORIENT_MIDDLE' | 'ORIENT_LONG';
export type TrackSprintClassification = 'SPRINT_PLACES_5_8';
export type TrackSprintPhase = 'SPRINT_THIRTY_SECOND_FINAL' | 'SPRINT_SIXTEENTH_FINAL' | 'SPRINT_EIGHTH_FINAL' | 'SPRINT_QUARTER_FINAL' | 'SPRINT_SEMI_FINAL'
  | 'SPRINT_BRONZE_FINAL' | 'SPRINT_GOLD_FINAL';
const TRACK_SPRINT_PHASES: readonly TrackSprintPhase[] = [
  'SPRINT_THIRTY_SECOND_FINAL', 'SPRINT_SIXTEENTH_FINAL', 'SPRINT_EIGHTH_FINAL', 'SPRINT_QUARTER_FINAL', 'SPRINT_SEMI_FINAL',
  'SPRINT_BRONZE_FINAL', 'SPRINT_GOLD_FINAL'
];
export const TRACK_SPRINT_REPECHAGES = [
  'SPRINT_REPECHAGE_1_32', 'SPRINT_REPECHAGE_1_16', 'SPRINT_REPECHAGE_1_8'
] as const;
const TRACK_SPRINT_CLASSIFICATION: readonly TrackSprintClassification[] = ['SPRINT_PLACES_5_8'];
const ORIENTEERING: readonly OrienteeringCourse[] = [
  'ORIENT_SPRINT', 'ORIENT_MIDDLE', 'ORIENT_LONG'
];
export type OpenWaterDistance = 'OWS_5K' | 'OWS_10K';
const OPEN_WATER: readonly OpenWaterDistance[] = ['OWS_5K', 'OWS_10K'];
export type SwimmingPoolEvent = 'FREE_50' | 'FREE_100' | 'FREE_200' | 'BACK_100'
  | 'BREAST_100' | 'FLY_100' | 'IM_200';
const SWIMMING_LCM: readonly SwimmingPoolEvent[] = [
  'FREE_50', 'FREE_100', 'FREE_200', 'BACK_100', 'BREAST_100', 'FLY_100', 'IM_200'
];
const RHYTHMIC_APPARATUS: readonly RhythmicApparatus[] = ['HOOP', 'BALL', 'CLUBS', 'RIBBON'];
const BODYBOARD_STANCES: readonly BodyboardStance[] = ['PRONE', 'DROP_KNEE'];

const GYM_APPARATUS: readonly GymApparatus[] = [
  'FLOOR', 'VAULT', 'POMMEL_HORSE', 'RINGS',
  'PARALLEL_BARS', 'HORIZONTAL_BAR', 'UNEVEN_BARS', 'BALANCE_BEAM'
];
const OPTIONS: Record<string, readonly AthleticsDiscipline[]> = {
  JUMP: ['LONG_JUMP', 'TRIPLE_JUMP', 'HIGH_JUMP', 'POLE_VAULT'],
  THROW: ['SHOT_PUT', 'DISCUS', 'JAVELIN', 'HAMMER']
};

export function athleticsDisciplineOptions(
  sport: string | null | undefined, eventType: string | null | undefined
): readonly (AthleticsDiscipline | GymApparatus | BodyboardStance | RhythmicApparatus | SwimmingPoolEvent | OpenWaterDistance | OrienteeringCourse | TrackSprintPhase | TrackSprintClassification | typeof TRACK_SPRINT_REPECHAGES[number])[] {
  const normalized = sport?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  if (normalized === 'ciclismo de pista' && eventType === 'TRACK_SPRINT_HEAT')
    return TRACK_SPRINT_PHASES;
  if (normalized === 'ciclismo de pista' && eventType === 'TRACK_SPRINT_REPECHAGE')
    return TRACK_SPRINT_REPECHAGES;
  if (normalized === 'ciclismo de pista' && eventType === 'TRACK_SPRINT_5_8')
    return TRACK_SPRINT_CLASSIFICATION;
  if (normalized === 'orientacao' && eventType === 'FOOT_ORIENTEERING') return ORIENTEERING;
  if (normalized === 'natacao em aguas abertas' && eventType === 'OWS_INDIVIDUAL') return OPEN_WATER;
  if (normalized === 'natacao' && eventType === 'SWIM_LCM') return SWIMMING_LCM;
  if (normalized === 'atletismo') return OPTIONS[eventType || ''] ?? [];
  if (normalized === 'ginastica artistica' && eventType === 'APPARATUS') return GYM_APPARATUS;
  if (normalized === 'bodyboard' && eventType === 'BODYBOARD_HEAT') return BODYBOARD_STANCES;
  if (normalized === 'ginastica ritmica' && eventType === 'RHYTHMIC_APPARATUS') return RHYTHMIC_APPARATUS;
  return [];
}

export function athleticsDisciplineValid(
  sport: string | null | undefined, eventType: string | null | undefined,
  discipline: string | null | undefined
): boolean {
  const options = athleticsDisciplineOptions(sport, eventType);
  return options.length
    ? options.includes(discipline as AthleticsDiscipline | GymApparatus | BodyboardStance | RhythmicApparatus | SwimmingPoolEvent | OpenWaterDistance | OrienteeringCourse | TrackSprintPhase | TrackSprintClassification | typeof TRACK_SPRINT_REPECHAGES[number])
    : !discipline;
}
