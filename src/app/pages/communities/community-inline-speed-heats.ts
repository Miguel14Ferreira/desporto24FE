import { CommunityRoundEntryDraft } from '../model/community-group';

/** A single organizer-entered heat, not a certified or linked tournament bracket. */
export const INLINE_SPEED_HEAT_CODES = [
  'INLINE_TRACK_500D_QUARTER_HEAT', 'INLINE_TRACK_500D_SEMI_HEAT',
  'INLINE_TRACK_500D_FINAL_A', 'INLINE_TRACK_500D_FINAL_B',
  'INLINE_ROAD_LAP_QUARTER_HEAT', 'INLINE_ROAD_LAP_SEMI_HEAT',
  'INLINE_ROAD_LAP_FINAL_A', 'INLINE_ROAD_LAP_FINAL_B'
] as const;

/** World Skate 2026: qualifying heats are limited to six skaters; the 200 m TT is exempt. */
export function inlineSpeedFirstHeatTooLarge(eventType: string | null | undefined,
  includedSkaters: number): boolean {
  return (eventType === 'INLINE_TRACK_500D_FIRST_ROUND'
    || eventType === 'INLINE_ROAD_LAP_FIRST_ROUND')
    && includedSkaters > 6;
}

export function isInlineSpeedHeatEvent(eventType: string | null | undefined): boolean {
  return !!eventType && INLINE_SPEED_HEAT_CODES.some(code => code === eventType);
}

export function isInlineSpeedFinalHeat(eventType: string | null | undefined): boolean {
  return isInlineSpeedHeatEvent(eventType)
    && (eventType!.endsWith('_FINAL_A') || eventType!.endsWith('_FINAL_B'));
}

type HeatEntry = Pick<CommunityRoundEntryDraft,
  'username' | 'team' | 'result' | 'goals' | 'assists' | 'mvp' | 'cleanSheet'
  | 'finishPosition' | 'elapsedSeconds' | 'bestLapSeconds' | 'lapsCompleted'
  | 'performanceValue' | 'waveScore1' | 'waveScore2'>;

/** Each included entrant needs a unique position from 1 to N, and may have a recorded time.
 * Validates a SINGLE heat; it does not determine judge decisions across rounds. */
export function inlineSpeedHeatError(eventType: string | null | undefined,
  entries: readonly HeatEntry[]): boolean {
  if (!isInlineSpeedHeatEvent(eventType)) return true;
  if (entries.length < 2 || entries.length > (isInlineSpeedFinalHeat(eventType) ? 4 : 6))
    return true;
  const usernames = new Set<string>();
  const places = new Set<number>();
  for (const entry of entries) {
    const username = entry.username?.trim().toLowerCase();
    const position = entry.finishPosition;
    if (!username || usernames.has(username)
      || position == null || !Number.isInteger(position)
      || position < 1 || position > entries.length || places.has(position)
      || !!entry.team?.trim() || entry.result !== 'DRAW'
      || (entry.goals ?? 0) !== 0 || (entry.assists ?? 0) !== 0
      || entry.mvp || entry.cleanSheet
      || entry.bestLapSeconds != null || entry.lapsCompleted != null
      || entry.performanceValue != null || entry.waveScore1 != null
      || entry.waveScore2 != null) return true;
    usernames.add(username);
    places.add(position);
    const time = entry.elapsedSeconds;
    if (time != null && (!Number.isFinite(time) || time <= 0 || time > 99999999.99
      || Math.abs(time * 100 - Math.round(time * 100)) > 1e-6)) return true;
  }
  return places.size !== entries.length;
}

/** Provisional top-two marker within one heat. Not automatic advancement. */
export function inlineSpeedCandidatePlace(eventType: string | null | undefined,
  place: number | null | undefined): boolean {
  return isInlineSpeedHeatEvent(eventType) && !isInlineSpeedFinalHeat(eventType)
    && (place === 1 || place === 2);
}
