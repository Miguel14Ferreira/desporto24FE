import { eventOptionsForSport, eventView, isRaceEvent, isNeutralEvent } from './community-round-event-type';
import { INLINE_SPEED_HEAT_CODES, isInlineSpeedHeatEvent, isInlineSpeedFinalHeat,
  inlineSpeedHeatError, inlineSpeedCandidatePlace, inlineSpeedFirstHeatTooLarge } from './community-inline-speed-heats';
import { CommunityRoundEntryDraft } from '../model/community-group';

describe('Inline speed skating — organizer-entered sprint heats', () => {
  const entrant = (username: string, position: number | null, time: number | null = null) =>
    ({ username, included: true, team: '', result: 'DRAW',
      goals: 0, assists: 0, mvp: false, cleanSheet: false,
      finishPosition: position, elapsedSeconds: time,
      bestLapSeconds: null, lapsCompleted: null, performanceValue: null,
      waveScore1: null, waveScore2: null } as CommunityRoundEntryDraft);

  it('registers all track/road quarter, semi and final A/B stage codes for the existing sport', () => {
    const options = eventOptionsForSport('Patinagem de Velocidade').map(x => x.code);
    for (const code of INLINE_SPEED_HEAT_CODES) {
      expect(options).toContain(code as typeof options[number]);
      expect(isInlineSpeedHeatEvent(code)).toBeTrue();
      expect(isRaceEvent('Patinagem de Velocidade', code)).toBeTrue();
      expect(isNeutralEvent('Patinagem de Velocidade', code)).toBeFalse();
      expect(eventView('Patinagem de Velocidade', code)).toBe('race');
      expect(isRaceEvent('Patinagem Artística', code)).toBeFalse();
    }
    expect(isInlineSpeedHeatEvent('INLINE_TRACK_500D_FIRST_ROUND')).toBeFalse();
    expect(isInlineSpeedHeatEvent(null)).toBeFalse();
    expect(eventView('Patinagem de Velocidade', null)).toBe('race');
  });

  it('requires unique, complete manual finish positions and permits optional recorded times', () => {
    for (const code of INLINE_SPEED_HEAT_CODES) {
      const valid = [entrant('ana', 2, 44.37), entrant('bruno', 1, null)];
      expect(inlineSpeedHeatError(code, valid)).toBeFalse();
      for (const entries of [
        [entrant('ana', 1)],
        [entrant('ana', null), entrant('bruno', 1)],
        [entrant('ana', 1), entrant('bruno', 1)],
        [entrant('ana', 1), entrant('bruno', 3)],
        [entrant('ana', 1), entrant(' ANA ', 2)],
        [entrant('ana', 1, 44.375), entrant('bruno', 2)],
        [entrant('ana', 1, -2), entrant('bruno', 2)]
      ]) expect(inlineSpeedHeatError(code, entries)).toBeTrue();
    }
    const bad = [entrant('ana', 1), entrant('bruno', 2)];
    bad[0].lapsCompleted = 1;
    expect(inlineSpeedHeatError('INLINE_TRACK_500D_SEMI_HEAT', bad)).toBeTrue();
    expect(inlineSpeedHeatError('INLINE_TRACK_500D_SEMI_HEAT',
      [entrant('a', 1), entrant('b', 2), entrant('c', 3), entrant('d', 4),
        entrant('e', 5)])).toBeFalse();
    expect(inlineSpeedHeatError('INLINE_TRACK_500D_FINAL_A',
      [entrant('a', 1), entrant('b', 2), entrant('c', 3), entrant('d', 4),
        entrant('e', 5)])).toBeTrue();
  });

  it('enforces at most six skaters in a first-round sprint heat, not in 200m time trials', () => {
    for (const code of ['INLINE_TRACK_500D_FIRST_ROUND', 'INLINE_ROAD_LAP_FIRST_ROUND']) {
      expect(inlineSpeedFirstHeatTooLarge(code, 6)).toBeFalse();
      expect(inlineSpeedFirstHeatTooLarge(code, 7)).toBeTrue();
    }
    expect(inlineSpeedFirstHeatTooLarge('INLINE_TRACK_200_TT', 20)).toBeFalse();
    expect(inlineSpeedFirstHeatTooLarge('INLINE_TRACK_500D_SEMI_HEAT', 7)).toBeFalse();
  });

  it('identifies provisional top two only in preceding heats; finals have no advancement', () => {
    expect(isInlineSpeedFinalHeat('INLINE_ROAD_LAP_FINAL_B')).toBeTrue();
    expect(isInlineSpeedFinalHeat('INLINE_TRACK_500D_SEMI_HEAT')).toBeFalse();
    expect(inlineSpeedCandidatePlace('INLINE_ROAD_LAP_QUARTER_HEAT', 1)).toBeTrue();
    expect(inlineSpeedCandidatePlace('INLINE_ROAD_LAP_SEMI_HEAT', 2)).toBeTrue();
    expect(inlineSpeedCandidatePlace('INLINE_ROAD_LAP_SEMI_HEAT', 3)).toBeFalse();
    expect(inlineSpeedCandidatePlace('INLINE_ROAD_LAP_FINAL_A', 1)).toBeFalse();
    expect(inlineSpeedCandidatePlace('INLINE_TRACK_200_TT', 1)).toBeFalse();
  });
});
