import { CommunityRound } from '../model/community-group';

export interface TrackSprintSeriesStatus {
  heats: number;
  winsA: number;
  winsB: number;
  riderA: string;
  riderB: string;
  winner: string | null;
}

/**
 * Read-only series verdict, only for an explicitly selected season.
 * Never infer historical series from titles or participant names.
 * The next bracket is not advanced automatically.
 */
export function trackSprintSeriesStatus(
  rounds: readonly CommunityRound[], current: CommunityRound, selectedSeasonId: number | null
): TrackSprintSeriesStatus | null {
  if (selectedSeasonId == null || current.eventType !== 'TRACK_SPRINT_HEAT' && current.eventType !== 'TRACK_SPRINT_REPECHAGE'
      || !current.sprintSeriesKey || !current.sprintHeatNumber) return null;
  // Three-up repechages have a distinct winner; the bracket records that
  // decision, never mislabel the third rider as side B in a two-up summary.
  if (current.eventDiscipline === 'SPRINT_REPECHAGE_1_32'
      || current.eventDiscipline === 'SPRINT_REPECHAGE_1_8') return null;
  const matches = rounds.filter(round => (round.eventType === 'TRACK_SPRINT_HEAT' || round.eventType === 'TRACK_SPRINT_REPECHAGE')
    && round.sprintSeriesKey === current.sprintSeriesKey);
  matches.sort((a, b) => (a.sprintHeatNumber ?? 0) - (b.sprintHeatNumber ?? 0));
  const phase = current.eventDiscipline;
  const required = phase === 'SPRINT_EIGHTH_FINAL' || phase === 'SPRINT_SIXTEENTH_FINAL'
    || phase === 'SPRINT_THIRTY_SECOND_FINAL' || phase?.startsWith('SPRINT_REPECHAGE_') ? 1 : 2;
  const max = required === 1 ? 1 : 3;
  if (matches.length === 0 || matches.length > max) return null;
  let riderA = '', riderB = '', winsA = 0, winsB = 0;
  for (let i = 0; i < matches.length; i++) {
    const round = matches[i];
    if (round.eventDiscipline !== phase || round.sprintHeatNumber !== i + 1
      || round.entries.length !== (phase === 'SPRINT_REPECHAGE_1_32' || phase === 'SPRINT_REPECHAGE_1_8' ? 3 : 2)) return null;
    const players = round.entries.map(entry => entry.username?.toLowerCase() || '');
    if (players.some(player => !player) || players[0] === players[1]) return null;
    if (i === 0) [riderA, riderB] = players;
    if (!players.includes(riderA) || !players.includes(riderB)) return null;
    const winners = round.entries.filter(entry => entry.result === 'WIN');
    const losers = round.entries.filter(entry => entry.result === 'LOSS');
    if (winners.length !== 1 || losers.length !== 1) return null;
    if (winners[0].username?.toLowerCase() === riderA) winsA++;
    else winsB++;
    if (i < matches.length - 1 && (winsA >= required || winsB >= required)) return null;
  }
  return { heats: matches.length, winsA, winsB, riderA, riderB,
    winner: winsA === required ? riderA : winsB === required ? riderB : null };
}
