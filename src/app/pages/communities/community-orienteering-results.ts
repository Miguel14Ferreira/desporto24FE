import { CommunityRoundEntryDraft } from '../model/community-group';

type OrienteeringEntry = Pick<CommunityRoundEntryDraft,
  'username' | 'finishPosition' | 'elapsedSeconds' | 'bestLapSeconds'
  | 'lapsCompleted' | 'performanceValue' | 'waveScore1' | 'waveScore2'>;

/**
 * The route's control punches cannot be verified from this DTO. Accept only
 * observed whole-second times, without invented placings or league points.
 */
export function orienteeringTimeError(entries: readonly OrienteeringEntry[]): boolean {
  if (!entries.length) return true;
  const usernames = new Set<string>();
  for (const entry of entries) {
    const username = entry.username?.trim().toLowerCase();
    if (!username || usernames.has(username)) return true;
    usernames.add(username);
    if (entry.finishPosition != null || entry.bestLapSeconds != null
        || entry.lapsCompleted != null || entry.performanceValue != null
        || entry.waveScore1 != null || entry.waveScore2 != null) return true;
    const time = entry.elapsedSeconds;
    if (time != null && (!Number.isSafeInteger(time) || time <= 0 || time > 99999999))
      return true;
  }
  return false;
}

export function formatOrienteeringTime(seconds: number | null | undefined): string | null {
  if (seconds == null || !Number.isSafeInteger(seconds) || seconds <= 0) return null;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = String(seconds % 60).padStart(2, '0');
  return hours > 0 ? hours + ':' + String(minutes).padStart(2, '0') + ':' + secs
    : minutes + ':' + secs;
}
