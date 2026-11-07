import { golfGrossTotal, golfStrokeStandings } from './community-golf-stroke-results';

describe('Gross golf stroke-play standings', () => {
  it('converts complete cards to backend-compatible gross stroke totals', () => {
    expect(golfGrossTotal(9, Array(9).fill(4))).toBe(36);
    expect(golfGrossTotal(18, Array(18).fill(4))).toBe(72);
    expect(golfGrossTotal(9, Array(9).fill(1))).toBe(9);
    expect(golfGrossTotal(18, Array(18).fill(1))).toBe(18);
    expect(golfGrossTotal(9, Array(9).fill(111112))).toBeNull();
    expect(golfGrossTotal(18, Array(18).fill(55556))).toBeNull();
    expect(golfGrossTotal(9, [4, 4])).toBeNull();
    expect(golfGrossTotal(18, null as any)).toBeNull();
  });

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

  it('assigns competition ranks across multiple tied groups without mutating the input', () => {
    const rounds = Object.freeze([
      { participantId: 5, strokesByHole: Object.freeze(Array(9).fill(6)) },
      { participantId: 4, strokesByHole: Object.freeze(Array(9).fill(5)) },
      { participantId: 3, strokesByHole: Object.freeze(Array(9).fill(5)) },
      { participantId: 2, strokesByHole: Object.freeze(Array(9).fill(4)) },
      { participantId: 1, strokesByHole: Object.freeze(Array(9).fill(4)) }
    ]);
    expect(golfStrokeStandings(9, rounds)).toEqual([
      { participantId: 1, totalStrokes: 36, rank: 1 },
      { participantId: 2, totalStrokes: 36, rank: 1 },
      { participantId: 3, totalStrokes: 45, rank: 3 },
      { participantId: 4, totalStrokes: 45, rank: 3 },
      { participantId: 5, totalStrokes: 54, rank: 5 }
    ]);
    expect(rounds[0].participantId).toBe(5);
  });

  it('accepts a complete eighteen-hole round without modifying the input', () => {
    const holes = Object.freeze(Array(18).fill(4)) as readonly number[];
    const rounds = Object.freeze([{ participantId: 7, strokesByHole: holes }]);
    expect(golfStrokeStandings(18, rounds)).toEqual([
      { participantId: 7, totalStrokes: 72, rank: 1 }
    ]);
  });

  it('rejects malformed API payloads without throwing', () => {
    const valid = { participantId: 1, strokesByHole: Array(9).fill(4) };
    const malformed = [
      null,
      undefined,
      {},
      { participantId: 2 },
      { participantId: 2, strokesByHole: null },
      { participantId: 2, strokesByHole: '444444444' }
    ];
    for (const item of malformed) {
      expect(() => golfStrokeStandings(9, [valid, item] as any))
        .withContext(String(item)).not.toThrow();
      expect(golfStrokeStandings(9, [valid, item] as any)).toBeNull();
    }
    expect(golfStrokeStandings(9, null as any)).toBeNull();
    expect(golfStrokeStandings(9, {} as any)).toBeNull();
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
