import { CommunityRound, CommunityRoundEntry, CommunityRoundEntryDraft } from '../model/community-group';

/** Provisional community marks: never official federation scores or season points. */
export function performanceKind(eventType: string | null | undefined): 'metres' | 'points' | null {
  if (eventType === 'JUMP' || eventType === 'THROW') return 'metres';
  if (eventType === 'FREESTYLE') return 'points';
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
    if (raw == null) return false; // participation-only remains possible
    const value = Number(raw);
    return !Number.isFinite(value) || value < 0
      || (kind === 'metres' && value <= 0)
      || (kind === 'points' && value > 100)
      || value > 999999.999
      || Math.abs(value * 1000 - Math.round(value * 1000)) > 1e-6;
  });
}

export function eventPerformanceEntries(round: CommunityRound): CommunityRoundEntry[] {
  return [...round.entries].sort((a, b) => {
    const av = a.performanceValue, bv = b.performanceValue;
    if (av == null) return bv == null ? 0 : 1;
    if (bv == null) return -1;
    return bv - av;
  });
}

/** Competition-style rank within ONE event only; identical marks share position. */
export function eventPerformancePlace(
  entries: CommunityRoundEntry[], entry: CommunityRoundEntry
): number | null {
  if (entry.performanceValue == null) return null;
  return 1 + entries.filter(other =>
    other.performanceValue != null && other.performanceValue > entry.performanceValue!
  ).length;
}

export function performanceDisplay(value: number | null | undefined): string {
  return value == null ? '—'
    : Number(value).toLocaleString('pt-PT', { maximumFractionDigits: 3 });
}
