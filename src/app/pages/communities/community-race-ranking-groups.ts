import { CommunityRaceStandingGroup } from '../model/community-group';
import { RACE_CHAMPIONSHIP_SPORTS } from '../../services/community-tournaments.service';

/**
 * A race community has an appropriate standings panel even before its first
 * classified finish. The placeholder never invents drivers or positions.
 */
export function raceRankingGroupsForCommunity(
  sports: readonly string[],
  reported: readonly CommunityRaceStandingGroup[] | null | undefined
): CommunityRaceStandingGroup[] {
  const normalized = (sport: string): string =>
    sport.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  const supported = new Map(RACE_CHAMPIONSHIP_SPORTS.map(sport => [normalized(sport), sport]));
  const selected = new Map<string, string>();
  for (const raw of sports) {
    const key = normalized(raw);
    const canonical = supported.get(key);
    if (canonical && !selected.has(key)) selected.set(key, canonical);
  }

  // Never display results from another (or previously selected) sport.
  // Keep the API's official order and original standing objects unchanged.
  const seen = new Set<string>();
  const groups: CommunityRaceStandingGroup[] = [];
  for (const group of reported ?? []) {
    const key = normalized(group.sport);
    if (!selected.has(key) || seen.has(key)) continue;
    groups.push(group);
    seen.add(key);
  }
  for (const [key, sport] of selected) {
    if (seen.has(key)) continue;
    groups.push({ sport, rule: null, standings: [] });
    seen.add(key);
  }
  return groups;
}
