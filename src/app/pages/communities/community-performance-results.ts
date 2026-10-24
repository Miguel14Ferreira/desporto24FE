import { CommunityRound, CommunityRoundEntry, CommunityRoundEntryDraft } from '../model/community-group';

/** Provisional community marks: never official federation scores or season points. */
export function performanceKind(eventType: string | null | undefined): 'metres' | 'points' | 'gym' | 'street' | 'trampoline' | 'rhythmic' | 'artistic' | 'golf' | 'poomsae' | null {
  if (eventType === 'TKD_POOMSAE_RECOGNIZED' || eventType === 'TKD_POOMSAE_FREESTYLE') return 'poomsae';
  if (eventType === 'GOLF_STROKE_9' || eventType === 'GOLF_STROKE_18') return 'golf';
  if (eventType === 'JUMP' || eventType === 'THROW') return 'metres';
  if (eventType === 'FREESTYLE'
      || eventType === 'SKATE_PARK' || eventType === 'PARKOUR_FREESTYLE') return 'points';
  if (eventType === 'SKATE_STREET') return 'street';
  if (eventType === 'TRAMPOLINE_INDIVIDUAL') return 'trampoline';
  if (eventType === 'RHYTHMIC_APPARATUS') return 'rhythmic';
  if (eventType === 'ARTISTIC_SOLO_TECHNICAL' || eventType === 'ARTISTIC_SOLO_FREE') return 'artistic';
  if (eventType === 'APPARATUS') return 'gym';
  return null;
}

export function performanceError(
  eventType: string | null | undefined,
  entries: Pick<CommunityRoundEntryDraft, 'performanceValue'>[]
): boolean {
  const kind = performanceKind(eventType);
  if (!kind) return entries.some(entry => entry.performanceValue != null);
  return entries.some(entry => {
    const raw = entry.performanceValue;
    if (raw == null) return kind === 'golf' || kind === 'poomsae'; // Confirmed final scores required.
    const value = Number(raw);
    if (kind === 'golf') {
      const holes = eventType === 'GOLF_STROKE_9' ? 9 : 18;
      return !Number.isInteger(value) || value < holes || value > 999999;
    }
    return !Number.isFinite(value) || value < 0
      || (kind === 'metres' && value <= 0)
      || ((kind === 'points' || kind === 'gym') && value > 100)
      || (kind === 'poomsae' && value > 10)
      || (kind === 'street' && value > 300)
      || (kind === 'trampoline' && value > 9999.99)
      || value > (kind === 'artistic' ? 999999.9999 : 999999.999)
      || (kind === 'trampoline'
        ? Math.abs(value * 100 - Math.round(value * 100)) > 1e-6
        : kind === 'artistic'
          ? Math.abs(value * 10000 - Math.round(value * 10000)) > 1e-6
          : Math.abs(value * 1000 - Math.round(value * 1000)) > 1e-6);
  });
}

/** Explicit wave heat types share numeric storage, NOT regulations, penalties or tie-break rules. */
export function isWaveHeatEvent(eventType: string | null | undefined): boolean {
  return eventType === 'HEAT' || eventType === 'BODYBOARD_HEAT';
}

/** Only the two adjudicated wave marks are entered, not judges' raw scoring. */
export function surfWaveTotal(entry: Pick<CommunityRoundEntry, 'waveScore1' | 'waveScore2'>): number | null {
  if (entry.waveScore1 == null && entry.waveScore2 == null) return null;
  return Math.round(((entry.waveScore1 ?? 0) + (entry.waveScore2 ?? 0)) * 1000) / 1000;
}
export function surfWaveError(entries: Pick<CommunityRoundEntryDraft, 'waveScore1' | 'waveScore2'>[]): boolean {
  return entries.some(entry => [entry.waveScore1, entry.waveScore2].some(mark =>
    mark != null && (!Number.isFinite(Number(mark)) || Number(mark) < 0 || Number(mark) > 10
      || Math.abs(Number(mark) * 1000 - Math.round(Number(mark) * 1000)) > 1e-6)
  ));
}
function scoreForEvent(entry: CommunityRoundEntry, type?: string | null): number | null {
  return isWaveHeatEvent(type) ? surfWaveTotal(entry) : entry.performanceValue ?? null;
}
export function eventPerformanceEntries(round: CommunityRound): CommunityRoundEntry[] {
  return [...round.entries].sort((a, b) => {
    const av = scoreForEvent(a, round.eventType), bv = scoreForEvent(b, round.eventType);
    if (av == null) return bv == null ? 0 : 1;
    if (bv == null) return -1;
    // For golf gross stroke play fewer strokes rank higher. All other judged/measured
    // result formats still rank higher totals first.
    return performanceKind(round.eventType) === 'golf' ? av - bv : bv - av;
  });
}

/** Competition-style rank within ONE event only; identical marks share position. */
export function eventPerformancePlace(
  entries: CommunityRoundEntry[], entry: CommunityRoundEntry, type?: string | null
): number | null {
  const score = scoreForEvent(entry, type);
  if (score == null) return null;
  return 1 + entries.filter(other => {
    const otherScore = scoreForEvent(other, type);
    return otherScore != null &&
      (performanceKind(type) === 'golf' ? otherScore < score : otherScore > score);
  }).length;
}

export function performanceDisplay(value: number | null | undefined, decimals = 3): string {
  return value == null ? '—'
    : Number(value).toLocaleString('pt-PT', { maximumFractionDigits: decimals });
}
