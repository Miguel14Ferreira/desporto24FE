import { CommunityRound } from '../model/community-group';
import { CommunityRoundView, formatForSport, viewForSport } from './community-round-sport';

/**
 * Explicitly supported event variants. This registry must be extended alongside
 * backend CommunityRoundEventType; it is NOT a complete rulebook for 121 sports.
 */
export type CommunityEventType = 'RACE' | 'FREESTYLE' | 'TRACK' | 'JUMP' | 'THROW' | 'HEAT' | 'BODYBOARD_HEAT' | 'APPARATUS'
  | 'SKATE_PARK' | 'SKATE_STREET' | 'PARKOUR_SPEED' | 'PARKOUR_FREESTYLE'
  | 'BREAKING_BATTLE' | 'TRAMPOLINE_INDIVIDUAL'
  | 'RHYTHMIC_APPARATUS' | 'ARTISTIC_SOLO_TECHNICAL' | 'ARTISTIC_SOLO_FREE'
  | 'RHYTHMIC_GROUP_5' | 'RHYTHMIC_GROUP_3_2'
  | 'ARTISTIC_DUET_TECH' | 'ARTISTIC_DUET_FREE'
  | 'ARTISTIC_TEAM_TECH' | 'ARTISTIC_TEAM_FREE'
  | 'BASKETBALL_FINAL' | 'BASKETBALL_3X3_FINAL'
  | 'VOLLEYBALL_FINAL' | 'BEACH_VOLLEY_FINAL' | 'HANDBALL_FINAL' | 'RUGBY_FINAL' | 'RUGBY_SEVENS_FINAL'
    | 'FUTSAL_FINAL' | 'FIELD_HOCKEY_FINAL' | 'ROLLER_HOCKEY_FINAL' | 'WATER_POLO_FINAL'
    | 'FOOTVOLLEY_SINGLE_18' | 'FOOTVOLLEY_BEST_OF_3' | 'FOOTVOLLEY_SINGLE_15'
    | 'ICE_HOCKEY_REG' | 'ICE_HOCKEY_OT' | 'ICE_HOCKEY_SO' | 'BASEBALL_RUNS' | 'SOFTBALL_RUNS' | 'KORFBALL_REG' | 'KORFBALL_GOLDEN'
    | 'LACROSSE_M_REG' | 'LACROSSE_M_OT' | 'AMFOOTBALL_SCORE' | 'FLAGFOOTBALL_SCORE' | 'CURLING_REG' | 'CURLING_EXTRA'
    | 'PETANQUE_13' | 'PETANQUE_11' | 'BOWLING_TENPIN' | 'POOL_9_RACKS' | 'FENCING_POOL_5' | 'FENCING_DE_15'
    | 'TEQBALL_SINGLES' | 'TEQBALL_DOUBLES' | 'CHESS_GAME' | 'CRICKET_T20';
export interface CommunityEventOption { code: CommunityEventType; labelKey: string }
const TYPES: Record<string, readonly CommunityEventOption[]> = {
  basquetebol: [{ code: 'BASKETBALL_FINAL', labelKey: 'communities.basketball.fiveVsFive' }],
  'basquetebol 3x3': [{ code: 'BASKETBALL_3X3_FINAL', labelKey: 'communities.basketball.threeVsThree' }],
  basebol: [{ code: 'BASEBALL_RUNS', labelKey: 'communities.teamFinal.baseballRuns' }],
  cricket: [{ code: 'CRICKET_T20', labelKey: 'communities.cricket.t20' }],
  softbol: [{ code: 'SOFTBALL_RUNS', labelKey: 'communities.teamFinal.softballRuns' }],
  corfebol: [
    { code: 'KORFBALL_REG', labelKey: 'communities.teamFinal.korfballReg' },
    { code: 'KORFBALL_GOLDEN', labelKey: 'communities.teamFinal.korfballGolden' }
  ],
  lacrosse: [
    { code: 'LACROSSE_M_REG', labelKey: 'communities.teamFinal.lacrosseMenReg' },
    { code: 'LACROSSE_M_OT', labelKey: 'communities.teamFinal.lacrosseMenOt' }
  ],
  'futebol americano': [{ code: 'AMFOOTBALL_SCORE', labelKey: 'communities.teamFinal.americanFootball' }],
  'flag football': [{ code: 'FLAGFOOTBALL_SCORE', labelKey: 'communities.teamFinal.flagFootball' }],
  curling: [
    { code: 'CURLING_REG', labelKey: 'communities.teamFinal.curlingReg' },
    { code: 'CURLING_EXTRA', labelKey: 'communities.teamFinal.curlingExtra' }
  ],
  petanca: [
    { code: 'PETANQUE_13', labelKey: 'communities.teamFinal.petanque13' },
    { code: 'PETANQUE_11', labelKey: 'communities.teamFinal.petanque11' }
  ],
  bowling: [{ code: 'BOWLING_TENPIN', labelKey: 'communities.teamFinal.bowlingTenpin' }],
  bilhar: [{ code: 'POOL_9_RACKS', labelKey: 'communities.teamFinal.poolNineBall' }],
  esgrima: [
    { code: 'FENCING_POOL_5', labelKey: 'communities.teamFinal.fencingPool' },
    { code: 'FENCING_DE_15', labelKey: 'communities.teamFinal.fencingElimination' }
  ],
  xadrez: [{ code: 'CHESS_GAME', labelKey: 'communities.eventType.chess_game' }],
  teqball: [
    { code: 'TEQBALL_SINGLES', labelKey: 'communities.teqball.singles' },
    { code: 'TEQBALL_DOUBLES', labelKey: 'communities.teqball.doubles' }
  ],
  voleibol: [{ code: 'VOLLEYBALL_FINAL', labelKey: 'communities.volleyball.indoor' }],
  'voleibol de praia': [{ code: 'BEACH_VOLLEY_FINAL', labelKey: 'communities.volleyball.beach' }],
  futevolei: [
    { code: 'FOOTVOLLEY_SINGLE_18', labelKey: 'communities.footvolley.single18' },
    { code: 'FOOTVOLLEY_BEST_OF_3', labelKey: 'communities.footvolley.bestOf3' },
    { code: 'FOOTVOLLEY_SINGLE_15', labelKey: 'communities.footvolley.single15' }
  ],
  andebol: [{ code: 'HANDBALL_FINAL', labelKey: 'communities.teamFinal.handball' }],
  rugby: [{ code: 'RUGBY_FINAL', labelKey: 'communities.teamFinal.rugby' }],
  'rugby sevens': [{ code: 'RUGBY_SEVENS_FINAL', labelKey: 'communities.teamFinal.sevens' }],
  'futsal': [{ code: 'FUTSAL_FINAL', labelKey: 'communities.teamFinal.futsal' }],
  'hoquei em campo': [{ code: 'FIELD_HOCKEY_FINAL', labelKey: 'communities.teamFinal.fieldHockey' }],
  'hoquei em patins': [{ code: 'ROLLER_HOCKEY_FINAL', labelKey: 'communities.teamFinal.rollerHockey' }],
  'hoquei no gelo': [
    { code: 'ICE_HOCKEY_REG', labelKey: 'communities.iceHockey.regulation' },
    { code: 'ICE_HOCKEY_OT', labelKey: 'communities.iceHockey.overtime' },
    { code: 'ICE_HOCKEY_SO', labelKey: 'communities.iceHockey.shootout' }
  ],
  'polo aquatico': [{ code: 'WATER_POLO_FINAL', labelKey: 'communities.teamFinal.waterPolo' }],
  bmx: [
    { code: 'RACE', labelKey: 'communities.eventType.race' },
    { code: 'FREESTYLE', labelKey: 'communities.eventType.freestyle' }
  ],
  atletismo: [
    { code: 'TRACK', labelKey: 'communities.eventType.track' },
    { code: 'JUMP', labelKey: 'communities.eventType.jump' },
    { code: 'THROW', labelKey: 'communities.eventType.throw' }
  ],
  snowboard: [
    { code: 'RACE', labelKey: 'communities.eventType.race' },
    { code: 'FREESTYLE', labelKey: 'communities.eventType.freestyle' }
  ],
  surf: [{ code: 'HEAT', labelKey: 'communities.eventType.heat' }],
  bodyboard: [{ code: 'BODYBOARD_HEAT', labelKey: 'communities.eventType.bodyboardHeat' }],
  'ginastica artistica': [{ code: 'APPARATUS', labelKey: 'communities.eventType.apparatus' }],
  skate: [
    { code: 'SKATE_PARK', labelKey: 'communities.eventType.skate_park' },
    { code: 'SKATE_STREET', labelKey: 'communities.eventType.skate_street' }
  ],
  parkour: [
    { code: 'PARKOUR_SPEED', labelKey: 'communities.eventType.parkour_speed' },
    { code: 'PARKOUR_FREESTYLE', labelKey: 'communities.eventType.parkour_freestyle' }
  ],
  breaking: [{ code: 'BREAKING_BATTLE', labelKey: 'communities.eventType.breaking_battle' }],
  trampolim: [{ code: 'TRAMPOLINE_INDIVIDUAL', labelKey: 'communities.eventType.trampoline_individual' }],
  'ginastica ritmica': [
    { code: 'RHYTHMIC_APPARATUS', labelKey: 'communities.eventType.rhythmic_app' },
    { code: 'RHYTHMIC_GROUP_5', labelKey: 'communities.eventType.rhythmic_group5' },
    { code: 'RHYTHMIC_GROUP_3_2', labelKey: 'communities.eventType.rhythmic_group32' }
  ],
  'natacao artistica': [
    { code: 'ARTISTIC_SOLO_TECHNICAL', labelKey: 'communities.eventType.artistic_tech' },
    { code: 'ARTISTIC_SOLO_FREE', labelKey: 'communities.eventType.artistic_free' },
    { code: 'ARTISTIC_DUET_TECH', labelKey: 'communities.eventType.artistic_duet_tech' },
    { code: 'ARTISTIC_DUET_FREE', labelKey: 'communities.eventType.artistic_duet_free' },
    { code: 'ARTISTIC_TEAM_TECH', labelKey: 'communities.eventType.artistic_team_tech' },
    { code: 'ARTISTIC_TEAM_FREE', labelKey: 'communities.eventType.artistic_team_free' }
  ]
};

function normalize(sport: string): string {
  return sport.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

export function eventOptionsForSport(sport: string | null | undefined): readonly CommunityEventOption[] {
  return sport ? TYPES[normalize(sport)] ?? [] : [];
}

export function isRaceEvent(sport: string | null | undefined, eventType: string | null | undefined): boolean {
  const name = sport ? normalize(sport) : '';
  if (name === 'atletismo') return eventType === 'TRACK';
  if (name === 'snowboard') return eventType === 'RACE';
  if (name === 'parkour') return eventType === 'PARKOUR_SPEED';
  if (name === 'bmx') return eventType == null || eventType === 'RACE'; // existing history
  return eventType == null && viewForSport(sport || null) === 'race';
}

export function eventView(sport: string | null | undefined, eventType: string | null | undefined): CommunityRoundView {
  if (eventOptionsForSport(sport).length && eventType == null) {
    // Preserve historical race/team round presentation without reinterpreting
    // legacy scores as typed event results. Newly typed rounds still use their event.
    if (normalize(sport!) === 'bmx') return 'race';
    return viewForSport(sport || null) === 'team' ? 'team' : 'individual';
  }
  if (isRaceEvent(sport, eventType)) return 'race';
  if (eventType != null) return 'individual';
  return viewForSport(sport || null);
}

export function isNeutralEvent(sport: string | null | undefined, eventType: string | null | undefined): boolean {
  return !!eventType && eventOptionsForSport(sport).some(option => option.code === eventType)
    && !isRaceEvent(sport, eventType);
}

/** No invented medals, marks, points or goals for an unimplemented score model. */
export function eventPresentationFormat(
  sport: string | null | undefined, eventType: string | null | undefined
): string {
  if (isRaceEvent(sport, eventType)) return 'race';
  if (eventType === 'CHESS_GAME' && normalize(sport || '') === 'xadrez') return 'duel';
  if (isNeutralEvent(sport, eventType))
    return ['FREESTYLE', 'HEAT', 'BODYBOARD_HEAT', 'APPARATUS',
      'SKATE_PARK', 'SKATE_STREET', 'PARKOUR_FREESTYLE',
      'BREAKING_BATTLE', 'TRAMPOLINE_INDIVIDUAL',
      'RHYTHMIC_APPARATUS', 'ARTISTIC_SOLO_TECHNICAL', 'ARTISTIC_SOLO_FREE',
      'RHYTHMIC_GROUP_5', 'RHYTHMIC_GROUP_3_2',
      'ARTISTIC_DUET_TECH', 'ARTISTIC_DUET_FREE',
      'ARTISTIC_TEAM_TECH', 'ARTISTIC_TEAM_FREE'].includes(eventType || '') ? 'judged'
      : ['BASKETBALL_FINAL', 'BASKETBALL_3X3_FINAL',
          'VOLLEYBALL_FINAL', 'BEACH_VOLLEY_FINAL',
          'TEQBALL_SINGLES', 'TEQBALL_DOUBLES',
          'FOOTVOLLEY_SINGLE_18', 'FOOTVOLLEY_BEST_OF_3', 'FOOTVOLLEY_SINGLE_15',
          'HANDBALL_FINAL', 'RUGBY_FINAL', 'RUGBY_SEVENS_FINAL',
          'FUTSAL_FINAL', 'FIELD_HOCKEY_FINAL', 'ROLLER_HOCKEY_FINAL', 'WATER_POLO_FINAL',
          'ICE_HOCKEY_REG', 'ICE_HOCKEY_OT', 'ICE_HOCKEY_SO',
          'BASEBALL_RUNS', 'SOFTBALL_RUNS', 'CRICKET_T20',
          'KORFBALL_REG', 'KORFBALL_GOLDEN',
          'LACROSSE_M_REG', 'LACROSSE_M_OT',
          'AMFOOTBALL_SCORE', 'FLAGFOOTBALL_SCORE',
          'CURLING_REG', 'CURLING_EXTRA', 'PETANQUE_13', 'PETANQUE_11',
          'BOWLING_TENPIN', 'POOL_9_RACKS',
          'FENCING_POOL_5', 'FENCING_DE_15'].includes(eventType || '') ? 'team'
      : 'measured';
  return formatForSport(sport || null);
}

export function roundIsNeutralEvent(round: Pick<CommunityRound, 'sport' | 'eventType'>): boolean {
  return isNeutralEvent(round.sport, round.eventType);
}
