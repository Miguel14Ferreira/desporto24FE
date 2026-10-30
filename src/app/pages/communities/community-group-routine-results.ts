import {
  CommunityGroupRoutineScore, CommunityRound, CommunityRoundEntryDraft
} from '../model/community-group';

/** Scores belong to one performing group, never to its individual members. */
export const groupRoutineTypes = [
  'RHYTHMIC_GROUP_5', 'RHYTHMIC_GROUP_3_2',
  'ARTISTIC_DUET_TECH', 'ARTISTIC_DUET_FREE',
  'ARTISTIC_TEAM_TECH', 'ARTISTIC_TEAM_FREE'
] as const;

export function isGroupRoutineEvent(type: string | null | undefined): boolean {
  return groupRoutineTypes.some(t => t === type);
}

export function routineGroupNames(entries: readonly Pick<CommunityRoundEntryDraft, 'team'>[]): string[] {
  const names = new Map<string, string>();
  for (const entry of entries) {
    const name = entry.team?.trim();
    if (name && !names.has(name.toLocaleLowerCase())) names.set(name.toLocaleLowerCase(), name);
  }
  return [...names.values()];
}

export function routineGroupError(
  type: string | null | undefined,
  entries: readonly Pick<CommunityRoundEntryDraft, 'team' | 'performanceValue'>[],
  marks: readonly CommunityGroupRoutineScore[]
): string | null {
  if (!isGroupRoutineEvent(type)) return marks.length ? 'groupRoutineInvalid' : null;
  const min = type!.startsWith('ARTISTIC_DUET') ? 2 : type!.startsWith('RHYTHMIC') ? 5 : 4;
  const max = type!.startsWith('ARTISTIC_DUET') ? 2 : type!.startsWith('RHYTHMIC') ? 5 : 8;
  if (!entries.length || !marks.length || marks.length > 32
      || entries.some(e => !e.team?.trim() || e.team.trim().length > 60
        || e.performanceValue != null)) return 'groupRoutineInvalid';
  const counts = new Map<string, number>();
  for (const e of entries) {
    const key = e.team.trim().toLocaleLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  if ([...counts.values()].some(n => n < min || n > max)) return 'groupRoutineSizeInvalid';
  if (counts.size !== marks.length) return 'groupRoutineInvalid';
  const used = new Set<string>();
  for (const mark of marks) {
    const key = mark.groupName?.trim().toLocaleLowerCase();
    const value = mark.score;
    if (!key || !counts.has(key) || used.has(key)) return 'groupRoutineInvalid';
    used.add(key);
    if (value != null) {
      const n = Number(value);
      const fraction = type!.startsWith('RHYTHMIC') ? 1000 : 10000;
      if (!Number.isFinite(n) || n < 0 || n >= 1000000
          || Math.abs(n * fraction - Math.round(n * fraction)) > 1e-5)
        return 'groupRoutineScoreInvalid';
    }
  }
  return null;
}

export function sortedRoutineGroups(round: Pick<CommunityRound, 'groupScores'>): CommunityGroupRoutineScore[] {
  return [...(round.groupScores ?? [])].sort((a, b) =>
    a.score == null ? b.score == null ? 0 : 1
      : b.score == null ? -1 : b.score - a.score);
}
export function routineGroupPlace(groups: readonly CommunityGroupRoutineScore[], current: CommunityGroupRoutineScore): number | null {
  return current.score == null ? null
    : 1 + groups.filter(x => x.score != null && x.score > current.score!).length;
}
export function routineGroupMembers(round: Pick<CommunityRound, 'entries'>, name: string): string[] {
  return round.entries.filter(e => e.team?.trim().toLocaleLowerCase() === name.trim().toLocaleLowerCase())
    .map(e => e.fullName || e.username || '');
}
