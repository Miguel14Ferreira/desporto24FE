import { CommunityRoundEntryDraft } from '../model/community-group';

type TimedOpenWaterEntry = Pick<CommunityRoundEntryDraft,
  'username' | 'finishPosition' | 'elapsedSeconds' | 'bestLapSeconds'
  | 'lapsCompleted' | 'performanceValue' | 'waveScore1' | 'waveScore2'>;

/** Community results only: no automatic finishing positions or World Aquatics points. */
export function openWaterTimeError(entries: readonly TimedOpenWaterEntry[]): boolean {
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
    if (value != null && (!Number.isFinite(value) || value <= 0
        || value > 99999999.9 || Math.abs(value * 10 - Math.round(value * 10)) > 1e-6))
      return true;
  }
  return false;
}

/** Format an organizer-recorded duration to tenths, with hours for long swims. */
export function formatOpenWaterTime(seconds: number | null | undefined): string | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return null;
  const tenths = Math.round(seconds * 10);
  const hours = Math.floor(tenths / 36000);
  const minutes = Math.floor((tenths % 36000) / 600);
  const wholeSeconds = Math.floor((tenths % 600) / 10);
  const ss = String(wholeSeconds).padStart(2, '0') + '.' + String(tenths % 10);
  return hours > 0 ? hours + ':' + String(minutes).padStart(2, '0') + ':' + ss
    : minutes + ':' + ss;
}
