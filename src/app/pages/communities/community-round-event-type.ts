import { CommunityRound } from '../model/community-group';
import { isInlineSpeedHeatEvent } from './community-inline-speed-heats';
import { CommunityRoundView, formatForSport, viewForSport } from './community-round-sport';

/**
 * Explicitly supported event variants. This registry must be extended alongside
 * backend CommunityRoundEventType; it is NOT a complete rulebook for 121 sports.
 */
export type CommunityEventType = 'TRACK_SCRATCH' | 'TRACK_TIME_TRIAL' | 'TRACK_FLYING_200' | 'TRACK_SPRINT_HEAT' | 'TRACK_SPRINT_REPECHAGE' | 'TRACK_SPRINT_5_8' | 'ROAD_RACE' | 'TIME_TRIAL' | 'RACE' | 'FREESTYLE' | 'TRACK' | 'JUMP' | 'THROW' | 'HEAT' | 'BODYBOARD_HEAT' | 'APPARATUS'
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
    | 'TEQBALL_SINGLES' | 'TEQBALL_DOUBLES' | 'CHESS_GAME' | 'CRICKET_T20' | 'GOLF_STROKE_9' | 'GOLF_STROKE_18'
    | 'JUDO_IPPON' | 'JUDO_AWASETE_IPPON' | 'JUDO_WAZA_ARI' | 'JUDO_YUKO' | 'JUDO_HANSOKU_MAKE'
    | 'KARATE_KUMITE_POINTS' | 'KARATE_KUMITE_SENSHU' | 'KARATE_KUMITE_HANTEI' | 'KARATE_KATA_JUDGES'
    | 'TKD_KYORUGI_BEST3' | 'TKD_POOMSAE_RECOGNIZED' | 'TKD_POOMSAE_FREESTYLE'
    | 'BJJ_IBJJF_GI_SUBMISSION' | 'BJJ_IBJJF_GI_POINTS'
    | 'BOXING_WB_POINTS' | 'BOXING_WB_KO' | 'BOXING_WB_RSC'
    | 'WAKO_POINT_FIGHTING' | 'WAKO_LIGHT_CONTACT' | 'WAKO_KICK_LIGHT'
    | 'WAKO_FULL_CONTACT' | 'WAKO_LOW_KICK' | 'WAKO_K1'
    | 'IFMA_FULL_WP' | 'IFMA_FULL_KO' | 'IFMA_FULL_RSCS' | 'IFMA_FULL_RSCI'
    | 'STRENGTH_TRAINING' | 'SWIM_LCM' | 'OWS_INDIVIDUAL' | 'FOOT_ORIENTEERING' | 'INLINE_TRACK_200_TT'
    | 'INLINE_TRACK_500D_FIRST_ROUND' | 'INLINE_ROAD_LAP_FIRST_ROUND'
    | 'INLINE_TRACK_500D_QUARTER_HEAT' | 'INLINE_TRACK_500D_SEMI_HEAT' | 'INLINE_TRACK_500D_FINAL_A' | 'INLINE_TRACK_500D_FINAL_B' | 'INLINE_ROAD_LAP_QUARTER_HEAT' | 'INLINE_ROAD_LAP_SEMI_HEAT' | 'INLINE_ROAD_LAP_FINAL_A' | 'INLINE_ROAD_LAP_FINAL_B';
export interface CommunityEventOption { code: CommunityEventType; labelKey: string }
const TYPES: Record<string, readonly CommunityEventOption[]> = {
  basquetebol: [{ code: 'BASKETBALL_FINAL', labelKey: 'communities.basketball.fiveVsFive' }],
  'basquetebol 3x3': [{ code: 'BASKETBALL_3X3_FINAL', labelKey: 'communities.basketball.threeVsThree' }],
  basebol: [{ code: 'BASEBALL_RUNS', labelKey: 'communities.teamFinal.baseballRuns' }],
  cricket: [{ code: 'CRICKET_T20', labelKey: 'communities.cricket.t20' }],
  golfe: [
    { code: 'GOLF_STROKE_9', labelKey: 'communities.golf.stroke9' },
    { code: 'GOLF_STROKE_18', labelKey: 'communities.golf.stroke18' }
  ],
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
  musculacao: [{ code: 'STRENGTH_TRAINING', labelKey: 'communities.strengthTraining.event' }],
  natacao: [{ code: 'SWIM_LCM', labelKey: 'communities.swimming.pool50m' }],
  'natacao em aguas abertas': [{ code: 'OWS_INDIVIDUAL', labelKey: 'communities.openWater.individual' }],
  orientacao: [{ code: 'FOOT_ORIENTEERING', labelKey: 'communities.orienteering.foot' }],
  'patinagem de velocidade': [
    { code: 'INLINE_TRACK_200_TT', labelKey: 'communities.speedSkating.track200tt' },
    { code: 'INLINE_TRACK_500D_FIRST_ROUND', labelKey: 'communities.speedSkating.track500first' },
    { code: 'INLINE_ROAD_LAP_FIRST_ROUND', labelKey: 'communities.speedSkating.roadLapFirst' },
    { code: 'INLINE_TRACK_500D_QUARTER_HEAT', labelKey: 'communities.speedSkating.track500Quarter' },
    { code: 'INLINE_TRACK_500D_SEMI_HEAT', labelKey: 'communities.speedSkating.track500Semi' },
    { code: 'INLINE_TRACK_500D_FINAL_A', labelKey: 'communities.speedSkating.track500FinalA' },
    { code: 'INLINE_TRACK_500D_FINAL_B', labelKey: 'communities.speedSkating.track500FinalB' },
    { code: 'INLINE_ROAD_LAP_QUARTER_HEAT', labelKey: 'communities.speedSkating.roadLapQuarter' },
    { code: 'INLINE_ROAD_LAP_SEMI_HEAT', labelKey: 'communities.speedSkating.roadLapSemi' },
    { code: 'INLINE_ROAD_LAP_FINAL_A', labelKey: 'communities.speedSkating.roadLapFinalA' },
    { code: 'INLINE_ROAD_LAP_FINAL_B', labelKey: 'communities.speedSkating.roadLapFinalB' }
  ],
  'muay thai': [
    { code: 'IFMA_FULL_WP', labelKey: 'communities.muayThai.fullWp' },
    { code: 'IFMA_FULL_KO', labelKey: 'communities.muayThai.fullKo' },
    { code: 'IFMA_FULL_RSCS', labelKey: 'communities.muayThai.fullRscSafety' },
    { code: 'IFMA_FULL_RSCI', labelKey: 'communities.muayThai.fullRscInjury' }
  ],
  kickboxing: [
    { code: 'WAKO_POINT_FIGHTING', labelKey: 'communities.kickboxing.pointFighting' },
    { code: 'WAKO_LIGHT_CONTACT', labelKey: 'communities.kickboxing.lightContact' },
    { code: 'WAKO_KICK_LIGHT', labelKey: 'communities.kickboxing.kickLight' },
    { code: 'WAKO_FULL_CONTACT', labelKey: 'communities.kickboxing.fullContact' },
    { code: 'WAKO_LOW_KICK', labelKey: 'communities.kickboxing.lowKick' },
    { code: 'WAKO_K1', labelKey: 'communities.kickboxing.k1' }
  ],
  boxe: [
    { code: 'BOXING_WB_POINTS', labelKey: 'communities.boxing.winPoints' },
    { code: 'BOXING_WB_KO', labelKey: 'communities.boxing.winKo' },
    { code: 'BOXING_WB_RSC', labelKey: 'communities.boxing.winRsc' }
  ],
  'jiu-jitsu brasileiro': [
    { code: 'BJJ_IBJJF_GI_SUBMISSION', labelKey: 'communities.bjj.submission' },
    { code: 'BJJ_IBJJF_GI_POINTS', labelKey: 'communities.bjj.points' }
  ],
  taekwondo: [
    { code: 'TKD_KYORUGI_BEST3', labelKey: 'communities.taekwondo.kyorugi' },
    { code: 'TKD_POOMSAE_RECOGNIZED', labelKey: 'communities.taekwondo.recognized' },
    { code: 'TKD_POOMSAE_FREESTYLE', labelKey: 'communities.taekwondo.freestyle' }
  ],
  karate: [
    { code: 'KARATE_KUMITE_POINTS', labelKey: 'communities.karate.kumitePoints' },
    { code: 'KARATE_KUMITE_SENSHU', labelKey: 'communities.karate.kumiteSenshu' },
    { code: 'KARATE_KUMITE_HANTEI', labelKey: 'communities.karate.kumiteHantei' },
    { code: 'KARATE_KATA_JUDGES', labelKey: 'communities.karate.kataJudges' }
  ],
  judo: [
    { code: 'JUDO_IPPON', labelKey: 'communities.judo.ippon' },
    { code: 'JUDO_AWASETE_IPPON', labelKey: 'communities.judo.awaseteIppon' },
    { code: 'JUDO_WAZA_ARI', labelKey: 'communities.judo.wazaAri' },
    { code: 'JUDO_YUKO', labelKey: 'communities.judo.yuko' },
    { code: 'JUDO_HANSOKU_MAKE', labelKey: 'communities.judo.hansokuMake' }
  ],
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
  'ciclismo de pista': [
    { code: 'TRACK_SCRATCH', labelKey: 'communities.trackCycling.scratch' },
    { code: 'TRACK_TIME_TRIAL', labelKey: 'communities.trackCycling.timeTrial' },
    { code: 'TRACK_FLYING_200', labelKey: 'communities.trackCycling.flying200' },
    { code: 'TRACK_SPRINT_HEAT', labelKey: 'communities.trackCycling.sprintHeat' },
    { code: 'TRACK_SPRINT_REPECHAGE', labelKey: 'communities.trackCycling.repechage' },
    { code: 'TRACK_SPRINT_5_8', labelKey: 'communities.trackCycling.placements58' }
  ],
  'ciclismo de estrada': [
    { code: 'ROAD_RACE', labelKey: 'communities.roadCycling.roadRace' },
    { code: 'TIME_TRIAL', labelKey: 'communities.roadCycling.timeTrial' }
  ],
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

/** World Skate 2026 (art. 51.5 / 115): these Finals B must remain readable
 * in historical results, but are not valid choices when creating a new round.
 */
export function isDiscontinuedInlineFinalB(eventType: string | null | undefined): boolean {
  return eventType === 'INLINE_TRACK_500D_FINAL_B'
    || eventType === 'INLINE_ROAD_LAP_FINAL_B';
}

export function eventOptionsForSport(sport: string | null | undefined): readonly CommunityEventOption[] {
  return sport ? TYPES[normalize(sport)] ?? [] : [];
}

/** Timed stages only; never imply final placings or automatic qualification. */
export function isInlineSpeedTimedEvent(eventType: string | null | undefined): boolean {
  return eventType === 'INLINE_TRACK_200_TT'
    || eventType === 'INLINE_TRACK_500D_FIRST_ROUND'
    || eventType === 'INLINE_ROAD_LAP_FIRST_ROUND';
}

export function isRaceEvent(sport: string | null | undefined, eventType: string | null | undefined): boolean {
  const name = sport ? normalize(sport) : '';
  if (name === 'atletismo') return eventType === 'TRACK';
  if (name === 'natacao') return eventType == null || eventType === 'SWIM_LCM';
  if (name === 'natacao em aguas abertas') return eventType == null || eventType === 'OWS_INDIVIDUAL';
  if (name === 'orientacao') return eventType == null || eventType === 'FOOT_ORIENTEERING';
  if (name === 'patinagem de velocidade') return eventType == null || isInlineSpeedTimedEvent(eventType) || isInlineSpeedHeatEvent(eventType);
  if (name === 'snowboard') return eventType === 'RACE';
  if (name === 'parkour') return eventType === 'PARKOUR_SPEED';
  if (name === 'bmx') return eventType == null || eventType === 'RACE'; // existing history
  if (name === 'ciclismo de estrada')
    return eventType == null || eventType === 'ROAD_RACE' || eventType === 'TIME_TRIAL';
  if (name === 'ciclismo de pista')
    return eventType == null || eventType === 'TRACK_SCRATCH' || eventType === 'TRACK_TIME_TRIAL'
      || eventType === 'TRACK_FLYING_200' || eventType === 'TRACK_SPRINT_5_8';
  return eventType == null && viewForSport(sport || null) === 'race';
}

export function eventView(sport: string | null | undefined, eventType: string | null | undefined): CommunityRoundView {
  if (eventOptionsForSport(sport).length && eventType == null) {
    // Preserve historical race/team round presentation without reinterpreting
    // legacy scores as typed event results. Newly typed rounds still use their event.
    if (normalize(sport!) === 'bmx' || normalize(sport!) === 'ciclismo de estrada' || normalize(sport!) === 'ciclismo de pista' || normalize(sport!) === 'natacao em aguas abertas' || normalize(sport!) === 'orientacao' || normalize(sport!) === 'patinagem de velocidade') return 'race';
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
  if (eventType === 'STRENGTH_TRAINING' && normalize(sport || '') === 'musculacao') return 'activity';
  if (eventType === 'CHESS_GAME' && normalize(sport || '') === 'xadrez') return 'duel';
  if ((eventType === 'TRACK_SPRINT_HEAT' || eventType === 'TRACK_SPRINT_REPECHAGE') && normalize(sport || '') === 'ciclismo de pista') return 'duel';
  if (eventType?.startsWith('JUDO_') && normalize(sport || '') === 'judo') return 'duel';
  if (eventType?.startsWith('KARATE_') && normalize(sport || '') === 'karate') return 'duel';
  if ((eventType === 'IFMA_FULL_WP' || eventType === 'IFMA_FULL_KO'
        || eventType === 'IFMA_FULL_RSCS' || eventType === 'IFMA_FULL_RSCI')
      && normalize(sport || '') === 'muay thai') return 'duel';
  if (eventType?.startsWith('WAKO_') && normalize(sport || '') === 'kickboxing') return 'duel';
  if ((eventType === 'BOXING_WB_POINTS' || eventType === 'BOXING_WB_KO'
        || eventType === 'BOXING_WB_RSC') && normalize(sport || '') === 'boxe') return 'duel';
  if ((eventType === 'BJJ_IBJJF_GI_SUBMISSION' || eventType === 'BJJ_IBJJF_GI_POINTS')
      && normalize(sport || '') === 'jiu-jitsu brasileiro') return 'duel';
  if (eventType === 'TKD_KYORUGI_BEST3' && normalize(sport || '') === 'taekwondo') return 'duel';
  if ((eventType === 'TKD_POOMSAE_RECOGNIZED' || eventType === 'TKD_POOMSAE_FREESTYLE')
      && normalize(sport || '') === 'taekwondo') return 'judged';
  if ((eventType === 'GOLF_STROKE_9' || eventType === 'GOLF_STROKE_18')
      && normalize(sport || '') === 'golfe') return 'score';
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
