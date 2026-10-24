import { eventOptionsForSport, eventView, eventPresentationFormat,
  isRaceEvent, isNeutralEvent, isInlineSpeedTimedEvent } from './community-round-event-type';
import { swimmingTimeError, formatSwimTime } from './community-swimming-results';
import { INLINE_SPEED_HEAT_CODES } from './community-inline-speed-heats';
import { raceEntryValidationError } from './community-race-metrics';
import { CommunityRoundEntryDraft } from '../model/community-group';

describe('Patinagem de Velocidade — inline 200m track time trial', () => {
  const skater = (username: string, seconds: number | null = null,
                  position: number | null = null) =>
    ({ username, included: true, team: '', result: 'DRAW',
      goals: 0, assists: 0, mvp: false, cleanSheet: false,
      elapsedSeconds: seconds, finishPosition: position,
      bestLapSeconds: null, lapsCompleted: null,
      performanceValue: null, waveScore1: null, waveScore2: null } as CommunityRoundEntryDraft);

  it('registers distinct track and road time-only first rounds for the existing speed sport', () => {
    expect(eventOptionsForSport('Patinagem de Velocidade').map(x => x.code))
      .toEqual(['INLINE_TRACK_200_TT', 'INLINE_TRACK_500D_FIRST_ROUND',
        'INLINE_ROAD_LAP_FIRST_ROUND', ...INLINE_SPEED_HEAT_CODES]);
    expect(eventOptionsForSport('Patinagem')).toEqual([]);
    expect(eventOptionsForSport('Patinagem Artística')).toEqual([]);
    expect(eventOptionsForSport('Hóquei em Patins').map(x => x.code))
      .not.toContain('INLINE_TRACK_200_TT');
    expect(eventOptionsForSport('Orientação').map(x => x.code))
      .toEqual(['FOOT_ORIENTEERING']);
  });

  it('shows the recorded elapsed time without placing or rewriting legacy races', () => {
    expect(isRaceEvent('Patinagem de Velocidade', 'INLINE_TRACK_200_TT')).toBeTrue();
    expect(isRaceEvent('Patinagem de Velocidade', null)).toBeTrue();
    expect(isNeutralEvent('Patinagem de Velocidade', 'INLINE_TRACK_200_TT')).toBeFalse();
    expect(eventView('Patinagem de Velocidade', 'INLINE_TRACK_200_TT')).toBe('race');
    expect(eventView('Patinagem de Velocidade', null)).toBe('race');
    expect(eventPresentationFormat('Patinagem de Velocidade', 'INLINE_TRACK_200_TT'))
      .toBe('race');
    expect(formatSwimTime(18.43)).toBe('0:18.43');
    expect(formatSwimTime(62.07)).toBe('1:02.07');
    expect(formatSwimTime(null)).toBeNull();
    expect(swimmingTimeError([skater('ana', 18.43), skater('bruno', null)])).toBeFalse();
    expect(raceEntryValidationError([skater('ana', 18.43)])).toBeNull();
  });

  it('rejects invented positions, duplicate skaters and sub-hundredth timings', () => {
    for (const entries of [
      [],
      [skater('ana', 18.432)],
      [skater('ana', 0)],
      [skater('ana', -1)],
      [skater('ana', 18.43, 1)],
      [skater('ana', 18.43), skater(' ANA ', 18.01)]
    ]) expect(swimmingTimeError(entries)).toBeTrue();
    const invalid = skater('ana', 18.43);
    invalid.lapsCompleted = 1;
    expect(swimmingTimeError([invalid])).toBeTrue();
  });

  it('keeps 500m+D and one-lap first rounds independent of official heats and finals', () => {
    for (const code of ['INLINE_TRACK_200_TT', 'INLINE_TRACK_500D_FIRST_ROUND',
      'INLINE_ROAD_LAP_FIRST_ROUND']) {
      expect(isInlineSpeedTimedEvent(code)).toBeTrue();
      expect(isRaceEvent('Patinagem de Velocidade', code)).toBeTrue();
      expect(isNeutralEvent('Patinagem de Velocidade', code)).toBeFalse();
      expect(eventView('Patinagem de Velocidade', code)).toBe('race');
      expect(eventPresentationFormat('Patinagem de Velocidade', code)).toBe('race');
      expect(swimmingTimeError([skater('ana', 45.37), skater('bruno', null)])).toBeFalse();
      expect(swimmingTimeError([skater('ana', 45.373)])).toBeTrue();
      expect(swimmingTimeError([skater('ana', 45.37, 1)])).toBeTrue();
    }
    expect(isInlineSpeedTimedEvent(null)).toBeFalse();
    expect(isInlineSpeedTimedEvent('INLINE_TRACK_500D_FINAL')).toBeFalse();
    expect(isInlineSpeedTimedEvent('INLINE_ROAD_LAP_FINAL')).toBeFalse();
    expect(isRaceEvent('Patinagem Artística', 'INLINE_ROAD_LAP_FIRST_ROUND')).toBeFalse();
    expect(isRaceEvent('Patinagem', 'INLINE_TRACK_500D_FIRST_ROUND')).toBeFalse();
    expect(eventOptionsForSport('Patinagem Artística')).toEqual([]);
    expect(eventView('Patinagem de Velocidade', null)).toBe('race');
  });
});
