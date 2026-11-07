import { golfStrokeStandings } from './community-golf-stroke-results';

describe('Gross golf stroke-play standings', () => {
  it('ranks complete nine-hole rounds by fewest strokes and preserves tied ranks', () => {
    const result = golfStrokeStandings(9, [
      { participantId: 3, strokesByHole: Array(9).fill(5) },
      { participantId: 2, strokesByHole: Array(9).fill(4) },
      { participantId: 1, strokesByHole: Array(9).fill(4) },
      { participantId: 4, strokesByHole: Array(9).fill(6) }
    ]);
    expect(result).toEqual([
      { participantId: 1, totalStrokes: 36, rank: 1 },
      { participantId: 2, totalStrokes: 36, rank: 1 },
      { participantId: 3, totalStrokes: 45, rank: 3 },
      { participantId: 4, totalStrokes: 54, rank: 4 }
    ]);
  });

  it('accepts a complete eighteen-hole round without modifying the input', () => {
    const holes = Object.freeze(Array(18).fill(4)) as readonly number[];
    const rounds = Object.freeze([{ participantId: 7, strokesByHole: holes }]);
    expect(golfStrokeStandings(18, rounds)).toEqual([
      { participantId: 7, totalStrokes: 72, rank: 1 }
    ]);
  });

  it('rejects incomplete rounds, duplicate entrants and invalid stroke counts', () => {
    const valid = { participantId: 1, strokesByHole: Array(9).fill(4) };
    expect(golfStrokeStandings(9, [])).toBeNull();
    expect(golfStrokeStandings(9, [valid, valid])).toBeNull();
    expect(golfStrokeStandings(9, [{ ...valid, strokesByHole: [4, 4] }])).toBeNull();
    for (const bad of [0, -1, 1.5, NaN, Infinity]) {
      expect(golfStrokeStandings(9, [{ ...valid, strokesByHole: [bad, ...Array(8).fill(4)] }]))
        .withContext(String(bad)).toBeNull();
    }
    for (const participantId of [0, -2, 1.5, NaN, Infinity]) {
      expect(golfStrokeStandings(9, [{ ...valid, participantId }]))
        .withContext(String(participantId)).toBeNull();
    }
    expect(golfStrokeStandings(9, [{ ...valid, strokesByHole: Array(18).fill(4) }])).toBeNull();
    expect(golfStrokeStandings(18, [valid])).toBeNull();
  });
});
