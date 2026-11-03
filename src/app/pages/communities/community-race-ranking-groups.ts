import { CommunityRaceStandingGroup } from '../model/community-group';
import { isRaceChampionshipSport } from '../../services/community-tournaments.service';

/**
 * A race community has an appropriate standings panel even before its first
 * classified finish. The placeholder never invents drivers or positions.
 */
export function raceRankingGroupsForCommunity(
  sports: readonly string[],
  reported: readonly CommunityRaceStandingGroup[] | null | undefined
): CommunityRaceStandingGroup[] {
  const groups = [...(reported ?? [])];
  const seen = new Set(groups.map(group => group.sport.trim().toLowerCase()));
  for (const raw of sports) {
    const sport = raw.trim();
    if (!isRaceChampionshipSport(sport) || seen.has(sport.toLowerCase())) continue;
    groups.push({ sport, rule: null, standings: [] });
    seen.add(sport.toLowerCase());
  }
  return groups;
}
