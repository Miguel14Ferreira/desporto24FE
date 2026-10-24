import { eventOptionsForSport, eventView, eventPresentationFormat,
  isRaceEvent, isNeutralEvent } from './community-round-event-type';
import { swimmingTimeError, formatSwimTime } from './community-swimming-results';
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

  it('registers exactly one initial type for the existing speed sport, not ice or artistic skating', () => {
    expect(eventOptionsForSport('Patinagem de Velocidade').map(x => x.code))
      .toEqual(['INLINE_TRACK_200_TT']);
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
});
