import { CommunityRound } from '../model/community-group';
import { trackSprintSeriesStatus } from './community-track-sprint-series';

function heat(id: number, phase: string, series: string | null, number: number | null,
  winner: 'ana' | 'rui'): CommunityRound {
  return {
    id, name: 'Sprint heat', playedAt: '2026-10-24T10:00:00Z',
    sport: 'Ciclismo de Pista', eventType: 'TRACK_SPRINT_HEAT',
    eventDiscipline: phase, sprintSeriesKey: series, sprintHeatNumber: number,
    entries: [
      { username: 'ana', result: winner === 'ana' ? 'WIN' : 'LOSS' },
      { username: 'rui', result: winner === 'rui' ? 'WIN' : 'LOSS' }
    ]
  } as CommunityRound;
}

describe('explicit track Sprint best of three series', () => {
  const semi = 'SPRINT_SEMI_FINAL', gold = 'SPRINT_GOLD_FINAL';
  it('keeps legacy and global all-season views unaggregated', () => {
    const existing = heat(1, semi, null, null, 'ana');
    expect(trackSprintSeriesStatus([existing], existing, 4)).toBeNull();
    const linked = heat(2, semi, 'S1', 1, 'ana');
    expect(trackSprintSeriesStatus([linked], linked, null)).toBeNull();
  });
  it('marks 2–0 as final and 1–1 as still pending', () => {
    const a = heat(1, semi, 'S1', 1, 'ana');
    const b = heat(2, semi, 'S1', 2, 'ana');
    expect(trackSprintSeriesStatus([a, b], b, 12)).toEqual({
      riderA: 'ana', riderB: 'rui', winsA: 2, winsB: 0, heats: 2, winner: 'ana'
    });
    const c = heat(3, gold, 'F1', 1, 'rui');
    const d = heat(4, gold, 'F1', 2, 'ana');
    expect(trackSprintSeriesStatus([c, d], c, 12)?.winner).toBeNull();
  });
  it('resolves 2–1 in finals and quarterfinals', () => {
    const rounds = [
      heat(1, gold, 'F', 1, 'ana'),
      heat(2, gold, 'F', 2, 'rui'),
      heat(3, gold, 'F', 3, 'rui')
    ];
    expect(trackSprintSeriesStatus(rounds, rounds[0], 12)?.winner).toBe('rui');
    const quarter = heat(4, 'SPRINT_QUARTER_FINAL', 'Q', 1, 'ana');
    expect(trackSprintSeriesStatus([quarter], quarter, 12)?.winner).toBeNull();
    const quarterTwo = heat(5, 'SPRINT_QUARTER_FINAL', 'Q', 2, 'ana');
    expect(trackSprintSeriesStatus([quarter, quarterTwo], quarter, 12)?.winner).toBe('ana');
  });
  it('never combines inconsistent phases, participants or numbered heats', () => {
    const a = heat(1, semi, 'S', 1, 'ana');
    const b = heat(2, gold, 'S', 2, 'rui');
    expect(trackSprintSeriesStatus([a, b], a, 12)).toBeNull();
    const c = heat(3, semi, 'S', 3, 'rui');
    expect(trackSprintSeriesStatus([a, c], a, 12)).toBeNull();
    const mixed = heat(4, semi, 'S', 2, 'ana');
    mixed.entries[1].username = 'bob';
    expect(trackSprintSeriesStatus([a, mixed], a, 12)).toBeNull();
  });
});
