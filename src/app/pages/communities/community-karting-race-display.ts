import { TournamentRaceEntry } from '../model/community-tournament';

/**
 * Pure presentation helpers: the Jornadas API remains the only source of
 * recorded times, race status and penalties. None of these helpers writes or
 * reclassifies a result on the server.
 */
export function orderedKartingRaceEntries(entries: readonly TournamentRaceEntry[]): TournamentRaceEntry[] {
  return entries.map((entry, index) => ({ entry, index }))
    .sort((left, right) => {
      const a = left.entry, b = right.entry;
      const rank = (entry: TournamentRaceEntry): number => {
        if (entry.raceDisqualified) return 2;
        if (entry.finishPosition == null || !Number.isInteger(entry.finishPosition)
            || entry.finishPosition < 1) return 1;
        return 0;
      };
      const groupDiff = rank(a) - rank(b);
      if (groupDiff) return groupDiff;
      if (rank(a) === 0) {
        const placeDiff = a.finishPosition! - b.finishPosition!;
        if (placeDiff) return placeDiff;
      }
      return left.index - right.index;
    })
    .map(({ entry }) => entry);
}

/** Seconds returned by the API -> mm:ss.mmm or h:mm:ss.mmm. */
export function formatKartingDuration(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value) || value < 0) return '—';
  const totalMilliseconds = Math.round(value * 1000);
  const hours = Math.floor(totalMilliseconds / 3_600_000);
  const minutes = Math.floor(totalMilliseconds / 60_000) % 60;
  const seconds = Math.floor(totalMilliseconds / 1000) % 60;
  const millis = totalMilliseconds % 1000;
  const two = (n: number) => n.toString().padStart(2, '0');
  const clock = `${two(minutes)}:${two(seconds)}.${millis.toString().padStart(3, '0')}`;
  return hours ? `${hours}:${clock}` : clock;
}

/** Same per-race points calculation as CommunityRaceStandings in the backend. */
export function kartingRaceAward(entry: TournamentRaceEntry, pointsByPlace: readonly number[]): number {
  const place = entry.finishPosition;
  if (entry.raceDisqualified || place == null || !Number.isInteger(place) || place < 1) return 0;
  const base = pointsByPlace[place - 1] ?? 0;
  const penalty = Math.max(0, entry.racePenaltyPoints ?? 0);
  return Math.max(0, base - penalty);
}
