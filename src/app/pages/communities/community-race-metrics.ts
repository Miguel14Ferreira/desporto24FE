import { CommunityRoundEntryDraft } from '../model/community-group';

/** Lap counts and best laps are appropriate for circuit and lap-based events. */
const LAP_SPORTS = new Set([
  'karting', 'automobilismo', 'motociclismo', 'motocross',
  'motonautica', 'ciclismo de pista', 'bmx',
  'mountain bike', 'ciclocrosse', 'patinagem de velocidade'
]);
const norm = (sport: string) =>
  sport.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

export function raceSupportsLaps(sport: string | null | undefined): boolean {
  return sport != null && LAP_SPORTS.has(norm(sport));
}

/** Only format observed values: no fake podium or derived finishing position. */
export function formatRaceSeconds(value: number | null | undefined): string | null {
  if (value == null || !Number.isFinite(value) || value <= 0) return null;
  const millis = Math.round(value * 1000);
  const mins = Math.floor(millis / 60000);
  const seconds = Math.floor((millis % 60000) / 1000);
  const fraction = String(millis % 1000).padStart(3, '0');
  return `${mins}:${String(seconds).padStart(2, '0')}.${fraction}`;
}

/** Same constraints as CommunityRaceMetrics.validate in the backend. */
/** Time-trial positions are organizer-recorded, not inferred from raw times.
 * Prevent half-entered results and circuit-only fields before API submission. */
export function roadTimeTrialEntryInvalid(
  entries: Pick<CommunityRoundEntryDraft, 'finishPosition' | 'elapsedSeconds' | 'bestLapSeconds' | 'lapsCompleted'>[]
): boolean {
  return entries.some(entry => (entry.finishPosition == null) !== (entry.elapsedSeconds == null)
    || entry.bestLapSeconds != null || entry.lapsCompleted != null);
}

export function raceEntryValidationError(
  entries: Pick<CommunityRoundEntryDraft, 'finishPosition' | 'elapsedSeconds' | 'bestLapSeconds' | 'lapsCompleted'>[]
): 'raceInvalidMetrics' | null {
  const positions = new Set<number>();
  for (const entry of entries) {
    const place = entry.finishPosition;
    if (place != null) {
      if (!Number.isInteger(place) || place < 1 || positions.has(place)) return 'raceInvalidMetrics';
      positions.add(place);
    }
    const laps = entry.lapsCompleted;
    if (laps != null && (!Number.isInteger(laps) || laps < 0)) return 'raceInvalidMetrics';
    for (const value of [entry.elapsedSeconds, entry.bestLapSeconds]) {
      if (value == null) continue;
      if (!Number.isFinite(value) || value <= 0 || value > 99999999.999
          || Math.abs(value * 1000 - Math.round(value * 1000)) > 1e-6) {
        return 'raceInvalidMetrics';
      }
    }
  }
  return null;
}
