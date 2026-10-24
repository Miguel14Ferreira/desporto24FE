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
  if (selectedSeasonId == null || current.eventType !== 'TRACK_SPRINT_HEAT'
      || !current.sprintSeriesKey || !current.sprintHeatNumber) return null;
  const matches = rounds.filter(round => round.eventType === 'TRACK_SPRINT_HEAT'
    && round.sprintSeriesKey === current.sprintSeriesKey);
  matches.sort((a, b) => (a.sprintHeatNumber ?? 0) - (b.sprintHeatNumber ?? 0));
  const phase = current.eventDiscipline;
  const max = phase === 'SPRINT_QUARTER_FINAL' ? 1 : 3;
  if (matches.length === 0 || matches.length > max) return null;
  let riderA = '', riderB = '', winsA = 0, winsB = 0;
  for (let i = 0; i < matches.length; i++) {
    const round = matches[i];
    if (round.eventDiscipline !== phase || round.sprintHeatNumber !== i + 1
      || round.entries.length !== 2) return null;
    const players = round.entries.map(entry => entry.username?.toLowerCase() || '');
    if (players.some(player => !player) || players[0] === players[1]) return null;
    if (i === 0) [riderA, riderB] = players;
    if (!players.includes(riderA) || !players.includes(riderB)) return null;
    const winners = round.entries.filter(entry => entry.result === 'WIN');
    const losers = round.entries.filter(entry => entry.result === 'LOSS');
    if (winners.length !== 1 || losers.length !== 1) return null;
    if (winners[0].username?.toLowerCase() === riderA) winsA++;
    else winsB++;
    if (i < matches.length - 1 && (winsA === 2 || winsB === 2
      || (max === 1 && (winsA === 1 || winsB === 1)))) return null;
  }
  const required = max === 1 ? 1 : 2;
  return { heats: matches.length, winsA, winsB, riderA, riderB,
    winner: winsA === required ? riderA : winsB === required ? riderB : null };
}
