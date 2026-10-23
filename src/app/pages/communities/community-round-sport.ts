import { CommunityGroup, CommunityRound } from '../model/community-group';

export type CommunityRoundView = 'team' | 'race' | 'individual' | 'unknown';

const TEAM_SPORTS = new Set([
  'futebol', 'futsal', 'basquetebol', 'basquetebol 3x3', 'andebol',
  'voleibol', 'voleibol de praia', 'rugby', 'rugby sevens',
  'hoquei', 'hoquei em campo', 'hoquei em patins', 'hoquei no gelo',
  'basebol', 'softbol', 'cricket', 'corfebol', 'polo aquatico',
  'flag football', 'futevolei', 'futebol americano'
]);
const RACE_SPORTS = new Set(['karting', 'karts', 'automobilismo', 'motociclismo', 'motocross']);

function normalized(sport: string): string {
  return sport.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

/**
 * An explicit round sport wins. For legacy rounds, infer only from a community
 * with exactly one sport; multi-sport communities must not guess from their
 * primary/default sport (football results must not be shown as kart results).
 */
export function sportForRound(
  round: Pick<CommunityRound, 'sport'>,
  group?: Pick<CommunityGroup, 'sport' | 'sports'>
): string | null {
  if (round.sport?.trim()) return round.sport.trim();
  if (!group) return null;
  const sports = group.sports?.length ? group.sports : (group.sport ? [group.sport] : []);
  return sports.length === 1 ? sports[0] : null;
}

export function viewForSport(sport: string | null): CommunityRoundView {
  if (!sport) return 'unknown';
  const key = normalized(sport);
  if (RACE_SPORTS.has(key)) return 'race';
  if (TEAM_SPORTS.has(key)) return 'team';
  return 'individual';
}
