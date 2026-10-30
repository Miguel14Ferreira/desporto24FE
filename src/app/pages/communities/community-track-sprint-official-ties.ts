import { CommunityRound } from '../model/community-group';
import { SprintTieDecision } from '../../services/community-groups.service';

export interface SprintQualificationTieGroup {
  key: string;
  milliseconds: number;
  riders: string[];
  /** Indicates when a tie crosses the exact 16/24/28 seeding cutoff. */
  crossesCutoff: boolean;
}
export interface SprintTieDraft {
  method: 'LAST_100' | 'DRAW_LOTS';
  reason: 'LAST_100_UNAVAILABLE' | 'LAST_100_STILL_TIED';
  reference: string;
  order: string[];
  last100Seconds: Record<string, string>;
}

function millis(value: number): number {
  return Math.round(value * 1000);
}
function name(value: string): string { return value.trim().toLowerCase(); }

/** Only relevant 200m ties (including the qualifying cutoff) need an official
 * UCI 3.2.027 decision. No name-based winner or finish order is inferred.
 */
export function sprintQualificationTieGroups(
  round: CommunityRound | undefined,
  starters: 16 | 24 | 28
): SprintQualificationTieGroup[] {
  if (!round || round.sport !== 'Ciclismo de Pista' ||
      round.eventType !== 'TRACK_FLYING_200') return [];
  const eligible = (round.entries || []).filter(e => !e.raceDisqualified
    && typeof e.elapsedSeconds === 'number' && Number.isFinite(e.elapsedSeconds)
    && e.elapsedSeconds > 0 && !!e.username?.trim())
    .map(e => ({ username: name(e.username!), ms: millis(e.elapsedSeconds!) }))
    .sort((a, b) => a.ms - b.ms || a.username.localeCompare(b.username));
  const ties: SprintQualificationTieGroup[] = [];
  for (let start = 0; start < eligible.length;) {
    let end = start + 1;
    while (end < eligible.length && eligible[end].ms === eligible[start].ms) end++;
    if (end - start > 1 && start < starters) ties.push({
      key: String(round.id) + '-' + eligible[start].ms,
      milliseconds: eligible[start].ms,
      riders: eligible.slice(start, end).map(x => x.username),
      crossesCutoff: start < starters && end > starters
    });
    start = end;
  }
  return ties;
}

export function emptySprintTieDraft(group: SprintQualificationTieGroup): SprintTieDraft {
  return {
    method: 'LAST_100',
    reason: 'LAST_100_UNAVAILABLE',
    reference: '',
    order: group.riders.map(() => ''), // never preselect a drawn result
    last100Seconds: {}
  };
}

function exactSeconds(input: string | undefined, maximumMs: number): number | null {
  if (!input || !/^\d{1,3}(?:\.\d{1,3})?$/.test(input.trim())) return null;
  const parsed = millis(Number(input));
  return parsed > 0 && parsed < maximumMs ? parsed : null;
}

/**
 * Builds API evidence only if every selected tie is completely resolved.
 * The backend revalidates against the *persisted* qualification and decides
 * whether the signed reference is admissible; this is only UX validation.
 */
export function sprintOfficialTieDecisions(
  groups: readonly SprintQualificationTieGroup[],
  drafts: Record<string, SprintTieDraft>
): SprintTieDecision[] | null {
  const decisions: SprintTieDecision[] = [];
  for (const group of groups) {
    const draft = drafts[group.key];
    if (!draft || draft.reference.trim().length < 12
        || draft.reference.trim().length > 255) return null;
    let order: string[], last100Seconds: Record<string, number> = {};
    if (draft.method === 'LAST_100') {
      for (const rider of group.riders) {
        const ms = exactSeconds(draft.last100Seconds[rider], group.milliseconds);
        if (ms == null) return null;
        last100Seconds[rider] = ms / 1000;
      }
      order = [...group.riders].sort((a, b) => last100Seconds[a] - last100Seconds[b]);
      if (order.some((r, index) => index > 0 &&
          last100Seconds[r] === last100Seconds[order[index - 1]])) return null;
    } else if (draft.method === 'DRAW_LOTS') {
      order = draft.order.map(name);
      if (order.length !== group.riders.length
          || new Set(order).size !== group.riders.length
          || !order.every(n => group.riders.includes(n))) return null;
      if (draft.reason === 'LAST_100_STILL_TIED') {
        for (const rider of group.riders) {
          const ms = exactSeconds(draft.last100Seconds[rider], group.milliseconds);
          if (ms == null) return null;
          last100Seconds[rider] = ms / 1000;
        }
        if (new Set(Object.values(last100Seconds)).size !== 1) return null;
      } else if (draft.reason !== 'LAST_100_UNAVAILABLE') return null;
    } else return null;
    decisions.push({
      method: draft.method,
      reason: draft.method === 'DRAW_LOTS' ? draft.reason : null,
      orderedUsernames: order,
      last100Seconds,
      reference: draft.reference.trim()
    });
  }
  return decisions;
}
