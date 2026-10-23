/**
 * Frontend guard, mirrored by CommunityRaceDecisions in the API.
 * An adjusted time is display-only: it never automatically changes finish order.
 */
export function raceDecisionError(
  seconds: number,
  disqualified: boolean,
  reason: string,
  originalSeconds: number | null | undefined
): boolean {
  return !Number.isFinite(seconds) || seconds < 0 || seconds > 3600
    || Math.abs(seconds * 1000 - Math.round(seconds * 1000)) > 1e-6
    || (seconds > 0 && originalSeconds == null)
    || ((seconds > 0 || disqualified) && !reason.trim())
    || reason.length > 255;
}
