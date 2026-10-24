import { CommunityRound } from '../model/community-group';
import { inlineProgressionStageValid, inlineProgressionSources,
  inlineProgressionSelectionError } from './community-inline-progression';

describe('Inline sprint manual heat links', () => {
  const race = (id: number, eventType: string, players: number[], hour: number) => ({
    id, eventType, sport: 'Patinagem de Velocidade',
    playedAt: new Date(Date.UTC(2026, 9, 24, hour)).toISOString(),
    entries: players.map(player => ({
      communityPlayerId: player, raceDisqualified: false
    }))
  } as CommunityRound);

  it('implements only World Skate 2026 valid paths, without Final B', () => {
    expect(inlineProgressionStageValid(
      'INLINE_TRACK_500D_FIRST_ROUND', 'INLINE_TRACK_500D_QUARTER_HEAT')).toBeTrue();
    expect(inlineProgressionStageValid(
      'INLINE_TRACK_500D_FIRST_ROUND', 'INLINE_TRACK_500D_SEMI_HEAT')).toBeTrue();
    expect(inlineProgressionStageValid(
      'INLINE_TRACK_500D_QUARTER_HEAT', 'INLINE_TRACK_500D_SEMI_HEAT')).toBeTrue();
    expect(inlineProgressionStageValid(
      'INLINE_ROAD_LAP_SEMI_HEAT', 'INLINE_ROAD_LAP_FINAL_A')).toBeTrue();
    expect(inlineProgressionStageValid(
      'INLINE_TRACK_500D_SEMI_HEAT', 'INLINE_TRACK_500D_FINAL_B')).toBeFalse();
    expect(inlineProgressionStageValid(
      'INLINE_TRACK_500D_FIRST_ROUND', 'INLINE_ROAD_LAP_SEMI_HEAT')).toBeFalse();
    expect(inlineProgressionStageValid(null, null)).toBeFalse();
  });

  it('allows manually joining multiple preceding heats only when all identities match', () => {
    const first = race(1, 'INLINE_TRACK_500D_QUARTER_HEAT', [10, 20], 10);
    const second = race(2, 'INLINE_TRACK_500D_QUARTER_HEAT', [30, 40], 10);
    const semi = race(3, 'INLINE_TRACK_500D_SEMI_HEAT', [20, 30], 11);
    expect(inlineProgressionSources(semi, [first, second, semi]).map(r => r.id))
      .toEqual([1, 2]);
    expect(inlineProgressionSelectionError(semi, [first])).toBeTrue();
    expect(inlineProgressionSelectionError(semi, [first, second])).toBeFalse();
    expect(inlineProgressionSelectionError(semi, [first, first])).toBeTrue();
    expect(inlineProgressionSelectionError(semi, [])).toBeTrue();
    const unrelated = race(4, 'INLINE_ROAD_LAP_QUARTER_HEAT', [20, 30], 10);
    expect(inlineProgressionSelectionError(semi, [first, unrelated])).toBeTrue();
  });

  it('does not link disqualified skaters or later heats', () => {
    const source = race(5, 'INLINE_ROAD_LAP_SEMI_HEAT', [101, 102], 10);
    source.entries[0].raceDisqualified = true;
    const target = race(6, 'INLINE_ROAD_LAP_FINAL_A', [101, 102], 11);
    expect(inlineProgressionSelectionError(target, [source])).toBeTrue();
    expect(inlineProgressionSources(target, [source]).length).toBe(1);
    const later = race(7, 'INLINE_ROAD_LAP_SEMI_HEAT', [101, 102], 13);
    expect(inlineProgressionSources(target, [later]).length).toBe(0);
  });
});
