import { historicalTournamentStandings } from './community-historical-tournament-standings';
import { HistoricalMatchArchive } from '../../services/community-groups.service';

describe('Historical Excel tournament standings', () => {
  const archive: HistoricalMatchArchive = {
    id: 1, title: 'CNG 2024', entryType: 'TEAM', sourceFilename: 'antigos.xlsx',
    createdAt: '2026-10-24T00:00:00Z', tournamentId: 4,
    rows: [
      { sourceRow: 2, home: 'Águias', away: 'Lobos', homeScore: 2, awayScore: 1, sourceDate: '2024-05-10', sourceRound: 'J1', potentialDuplicate: false },
      { sourceRow: 3, home: 'Lobos', away: 'CNG', homeScore: 0, awayScore: 0, sourceDate: '2024-05-17', sourceRound: 'J2', potentialDuplicate: false },
      { sourceRow: 4, home: 'Águias', away: 'Lobos', homeScore: 2, awayScore: 1, sourceDate: '2024-05-10', sourceRound: 'J1', potentialDuplicate: true }
    ]
  };
  it('calculates a league table without counting flagged potential duplicates', () => {
    const table = historicalTournamentStandings(archive);
    expect(table.map(r => r.name)).toEqual(['Águias', 'CNG', 'Lobos']);
    expect(table[0]).toEqual(jasmine.objectContaining({ played: 1, won: 1, points: 3, difference: 1 }));
    expect(table[2]).toEqual(jasmine.objectContaining({ played: 2, lost: 1, drawn: 1, points: 1 }));
  });
  it('never mutates the original Excel rows', () => {
    const original = JSON.stringify(archive.rows);
    historicalTournamentStandings(archive);
    expect(JSON.stringify(archive.rows)).toBe(original);
  });
});
