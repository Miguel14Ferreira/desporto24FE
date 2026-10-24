import { CommunityRound } from '../model/community-group';

/**
 * World Skate 2026 500 m +D / One Lap:
 * first timed round -> quarters (or semis for smaller fields);
 * quarters -> semis; semis -> Final A. No new Final B.
 * Eligibility and exceptions are never auto-certified here.
 */
export function inlineProgressionStageValid(source: string | null | undefined,
  target: string | null | undefined): boolean {
  if (!source || !target) return false;
  const prefix = source.startsWith('INLINE_TRACK_500D_') ? 'INLINE_TRACK_500D_'
    : source.startsWith('INLINE_ROAD_LAP_') ? 'INLINE_ROAD_LAP_' : null;
  if (!prefix || !target.startsWith(prefix)) return false;
  const stage = source.slice(prefix.length);
  return stage === 'FIRST_ROUND'
    ? (target === prefix + 'QUARTER_HEAT' || target === prefix + 'SEMI_HEAT')
    : stage === 'QUARTER_HEAT' ? target === prefix + 'SEMI_HEAT'
    : stage === 'SEMI_HEAT' ? target === prefix + 'FINAL_A' : false;
}

/** Available source heats must share actual historical player identities. */
export function inlineProgressionSources(target: CommunityRound,
  rounds: readonly CommunityRound[]): CommunityRound[] {
  const targetPlayers = new Set(target.entries.map(e => e.communityPlayerId)
    .filter((id): id is number => id != null));
  return rounds.filter(source =>
    source.id !== target.id
    && inlineProgressionStageValid(source.eventType, target.eventType)
    && Date.parse(source.playedAt) <= Date.parse(target.playedAt)
    && source.entries.some(e => e.communityPlayerId != null
      && targetPlayers.has(e.communityPlayerId) && !e.raceDisqualified)
  );
}

/** Explicit user confirmation required; never infer qualification from a place or time. */
export function inlineProgressionSelectionError(target: CommunityRound,
  sources: readonly CommunityRound[]): boolean {
  if (!sources.length || sources.length > 20) return true;
  const seenSourceIds = new Set<number>();
  const sourcePlayers = new Set<number>();
  for (const source of sources) {
    if (seenSourceIds.has(source.id)
        || !inlineProgressionStageValid(source.eventType, target.eventType)
        || Date.parse(source.playedAt) > Date.parse(target.playedAt)) return true;
    seenSourceIds.add(source.id);
    for (const entry of source.entries) {
      const playerId = entry.communityPlayerId;
      if (playerId != null && !entry.raceDisqualified) {
        if (sourcePlayers.has(playerId)) return true;
        sourcePlayers.add(playerId);
      }
    }
  }
  return !target.entries.length
    || target.entries.some(entry => entry.communityPlayerId == null
      || !sourcePlayers.has(entry.communityPlayerId));
}
