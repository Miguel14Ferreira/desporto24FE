import { historicalTournamentStandings, canEstimateHistoricalLeagueStandings } from './community-historical-tournament-standings';
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
    expect(table.map(row => row.rank)).toEqual([1, 2, 2]);
    expect(table.map(row => row.tiedOnPoints)).toEqual([false, true, true]);
  });

  it('does not invent a first place from goal difference when the points are tied', () => {
    const tied: HistoricalMatchArchive = {
      ...archive,
      rows: [
        { sourceRow: 2, home: 'Zeta', away: 'Alfa', homeScore: 5, awayScore: 0,
          sourceDate: '2024-05-10', sourceRound: 'J1', potentialDuplicate: false },
        { sourceRow: 3, home: 'Alfa', away: 'Zeta', homeScore: 3, awayScore: 0,
          sourceDate: '2024-05-17', sourceRound: 'J2', potentialDuplicate: false }
      ]
    };
    const table = historicalTournamentStandings(tied);
    expect(table.map(row => row.name)).toEqual(['Alfa', 'Zeta']);
    expect(table.map(row => row.points)).toEqual([3, 3]);
    expect(table.map(row => row.rank)).toEqual([1, 1]);
    expect(table.every(row => row.tiedOnPoints)).toBeTrue();
    // Both original score differentials remain visible but are not tie-breaks.
    expect(table.map(row => row.difference)).toEqual([-2, 2]);
  });

  it('keeps competition ranks across multiple point ties without making up places', () => {
    const multiple: HistoricalMatchArchive = {
      ...archive,
      rows: [
        { sourceRow: 2, home: 'Ana', away: 'Bia', homeScore: 2, awayScore: 1,
          sourceDate: '', sourceRound: 'J1', potentialDuplicate: false },
        { sourceRow: 3, home: 'Ana', away: 'Cris', homeScore: 3, awayScore: 1,
          sourceDate: '', sourceRound: 'J2', potentialDuplicate: false },
        { sourceRow: 4, home: 'Ana', away: 'Dina', homeScore: 4, awayScore: 1,
          sourceDate: '', sourceRound: 'J3', potentialDuplicate: false },
        { sourceRow: 5, home: 'Bia', away: 'Cris', homeScore: 1, awayScore: 0,
          sourceDate: '', sourceRound: 'J4', potentialDuplicate: false },
        { sourceRow: 6, home: 'Dina', away: 'Cris', homeScore: 2, awayScore: 0,
          sourceDate: '', sourceRound: 'J5', potentialDuplicate: false }
      ]
    };
    const table = historicalTournamentStandings(multiple);
    expect(table.map(row => row.points)).toEqual([9, 3, 3, 0]);
    expect(table.map(row => row.rank)).toEqual([1, 2, 2, 4]);
    expect(table.map(row => row.tiedOnPoints)).toEqual([false, true, true, false]);
  });
  it('only allows provisional tables for catalogued compatible numeric head-to-head sports', () => {
    expect(canEstimateHistoricalLeagueStandings('Futebol')).toBeTrue();
    expect(canEstimateHistoricalLeagueStandings('Basquetebol')).toBeTrue();
    for (const sport of ['Karting', 'Ciclismo', 'Golfe', 'Xadrez',
      'Natação', 'Surf', 'Tiro com Arco', 'Modalidade inventada', '', null]) {
      expect(canEstimateHistoricalLeagueStandings(sport))
        .withContext(String(sport)).toBeFalse();
    }
  });

  it('never mutates the original Excel rows', () => {
    const original = JSON.stringify(archive.rows);
    historicalTournamentStandings(archive);
    expect(JSON.stringify(archive.rows)).toBe(original);
  });
});
