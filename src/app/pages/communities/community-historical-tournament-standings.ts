import { HistoricalMatchArchive } from '../../services/community-groups.service';
import { SPORTS_CATALOG } from '../../shared/sports-catalog';
import { tournamentClassificationProfile } from './community-tournament-classification';

/**
 * An archived score pair is not necessarily a head-to-head match with
 * conventional win/draw/loss points. Gate provisional league tables on the
 * canonical Jynlo sport and its already defined numeric-result capability.
 * A stored historic source remains readable even when this returns false.
 */
export function canEstimateHistoricalLeagueStandings(sport: string | null | undefined): boolean {
  const selected = sport?.trim();
  if (!selected || !SPORTS_CATALOG.includes(selected)) return false;
  const profile = tournamentClassificationProfile(selected);
  return profile.isRoundRobinSupported && !profile.scoringMode;
}

export interface HistoricalTournamentStanding {
  name: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  difference: number;
  points: number;
}

/**
 * Read-only estimated standings from the original Excel rows.
 * Historical names never become platform accounts and possible duplicate
 * exports are visible in the matches but ignored in this calculation.
 */
export function historicalTournamentStandings(
  archive: HistoricalMatchArchive,
  winPoints = 3, drawPoints = 1, lossPoints = 0
): HistoricalTournamentStanding[] {
  const byName = new Map<string, HistoricalTournamentStanding>();
  const get = (name: string): HistoricalTournamentStanding => {
    const key = name.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
    let row = byName.get(key);
    if (!row) {
      row = {
        name: name.trim(), played: 0, won: 0, drawn: 0, lost: 0,
        goalsFor: 0, goalsAgainst: 0, difference: 0, points: 0
      };
      byName.set(key, row);
    }
    return row;
  };
  for (const match of archive.rows) {
    if (match.potentialDuplicate) continue;
    const home = get(match.home), away = get(match.away);
    home.played++; away.played++;
    home.goalsFor += match.homeScore; home.goalsAgainst += match.awayScore;
    away.goalsFor += match.awayScore; away.goalsAgainst += match.homeScore;
    if (match.homeScore > match.awayScore) {
      home.won++; away.lost++; home.points += winPoints; away.points += lossPoints;
    } else if (match.homeScore < match.awayScore) {
      away.won++; home.lost++; away.points += winPoints; home.points += lossPoints;
    } else {
      home.drawn++; away.drawn++; home.points += drawPoints; away.points += drawPoints;
    }
  }
  for (const row of byName.values()) row.difference = row.goalsFor - row.goalsAgainst;
  return [...byName.values()].sort((a, b) =>
    b.points - a.points || b.difference - a.difference || b.goalsFor - a.goalsFor
    || b.won - a.won || a.name.localeCompare(b.name, 'pt'));
}
