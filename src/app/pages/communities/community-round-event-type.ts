import { CommunityRound } from '../model/community-group';
import { CommunityRoundView, formatForSport, viewForSport } from './community-round-sport';

/**
 * Explicitly supported event variants. This registry must be extended alongside
 * backend CommunityRoundEventType; it is NOT a complete rulebook for 121 sports.
 */
export type CommunityEventType = 'RACE' | 'FREESTYLE' | 'TRACK' | 'JUMP' | 'THROW' | 'HEAT' | 'BODYBOARD_HEAT' | 'APPARATUS'
  | 'SKATE_PARK' | 'SKATE_STREET' | 'PARKOUR_SPEED' | 'PARKOUR_FREESTYLE';
export interface CommunityEventOption { code: CommunityEventType; labelKey: string }
const TYPES: Record<string, readonly CommunityEventOption[]> = {
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
    // BMX legacy rounds were recorded as races before event variants existed.
    return normalize(sport!) === 'bmx' ? 'race' : 'individual';
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
  if (isNeutralEvent(sport, eventType))
    return ['FREESTYLE', 'HEAT', 'BODYBOARD_HEAT', 'APPARATUS',
      'SKATE_PARK', 'SKATE_STREET', 'PARKOUR_FREESTYLE'].includes(eventType || '') ? 'judged' : 'measured';
  return formatForSport(sport || null);
}

export function roundIsNeutralEvent(round: Pick<CommunityRound, 'sport' | 'eventType'>): boolean {
  return isNeutralEvent(round.sport, round.eventType);
}
