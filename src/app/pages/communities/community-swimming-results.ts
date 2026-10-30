import { CommunityRoundEntryDraft } from '../model/community-group';

/** Recorded community times only: no federation judgement or inferred finishing positions. */
export function swimmingTimeError(
  entries: readonly Pick<CommunityRoundEntryDraft,
    'username' | 'finishPosition' | 'elapsedSeconds' | 'bestLapSeconds'
    | 'lapsCompleted' | 'performanceValue' | 'waveScore1' | 'waveScore2'>[]
): boolean {
  if (!entries.length) return true;
  const usernames = new Set<string>();
  for (const entry of entries) {
    const username = entry.username?.trim().toLowerCase();
    if (!username || usernames.has(username)) return true;
    usernames.add(username);
    if (entry.finishPosition != null || entry.bestLapSeconds != null
        || entry.lapsCompleted != null || entry.performanceValue != null
        || entry.waveScore1 != null || entry.waveScore2 != null) return true;
    const value = entry.elapsedSeconds;
    if (value != null && (!Number.isFinite(value) || value <= 0 || value > 99999999.99
        || Math.abs(value * 100 - Math.round(value * 100)) > 1e-6)) return true;
  }
  return false;
}

/** Display already recorded hundredth precision; no fabricated competition placings. */
export function formatSwimTime(seconds: number | null | undefined): string | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return null;
  const hundredths = Math.round(seconds * 100);
  const minutes = Math.floor(hundredths / 6000);
  const remainingSeconds = Math.floor((hundredths % 6000) / 100);
  return minutes + ':' + String(remainingSeconds).padStart(2, '0') + '.'
    + String(hundredths % 100).padStart(2, '0');
}
