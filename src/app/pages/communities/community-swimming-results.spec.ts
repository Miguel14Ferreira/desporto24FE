import { eventOptionsForSport, eventPresentationFormat, eventView,
  isNeutralEvent, isRaceEvent } from './community-round-event-type';
import { athleticsDisciplineOptions, athleticsDisciplineValid } from './community-field-disciplines';
import { formatSwimTime, swimmingTimeError } from './community-swimming-results';
import { raceEntryValidationError } from './community-race-metrics';
import { CommunityRoundEntryDraft } from '../model/community-group';

describe('Natação: individual 50m-pool results', () => {
  const swimmer = (username: string, time: number | null = null, position: number | null = null) =>
    ({ username, included: true, team: '', result: 'DRAW',
      goals: 0, assists: 0, mvp: false, cleanSheet: false,
      elapsedSeconds: time, finishPosition: position,
      bestLapSeconds: null, lapsCompleted: null,
      performanceValue: null, waveScore1: null, waveScore2: null } as CommunityRoundEntryDraft);

  it('offers only seven distance/stroke combinations for the existing Natação sport', () => {
    expect(eventOptionsForSport('Natação').map(e => e.code)).toEqual(['SWIM_LCM']);
    expect(athleticsDisciplineOptions('Natação', 'SWIM_LCM')).toEqual([
      'FREE_50', 'FREE_100', 'FREE_200', 'BACK_100', 'BREAST_100', 'FLY_100', 'IM_200'
    ]);
    expect(athleticsDisciplineValid('Natação', 'SWIM_LCM', 'FREE_50')).toBeTrue();
    expect(athleticsDisciplineValid('Natação', 'SWIM_LCM', null)).toBeFalse();
    expect(athleticsDisciplineValid('Natação', 'SWIM_LCM', 'IM_100')).toBeFalse();
    expect(athleticsDisciplineValid('Natação Artística', 'SWIM_LCM', 'FREE_50')).toBeFalse();
    expect(eventOptionsForSport('Natação Artística').some(x => x.code === 'SWIM_LCM')).toBeFalse();
    expect(eventOptionsForSport('Natação em Águas Abertas').map(event => event.code))
      .toEqual(['OWS_INDIVIDUAL']);
  });

  it('reuses race time display but not generic place or football WDL scoring', () => {
    expect(isRaceEvent('Natação', 'SWIM_LCM')).toBeTrue();
    expect(isRaceEvent('Natação', null)).toBeTrue(); // historical races preserved
    expect(isNeutralEvent('Natação', 'SWIM_LCM')).toBeFalse();
    expect(eventView('Natação', 'SWIM_LCM')).toBe('race');
    expect(eventPresentationFormat('Natação', 'SWIM_LCM')).toBe('race');
    expect(formatSwimTime(62.43)).toBe('1:02.43');
    expect(formatSwimTime(28.05)).toBe('0:28.05');
    expect(formatSwimTime(null)).toBeNull();
    expect(swimmingTimeError([swimmer('ana', 28.47), swimmer('bruno', null)])).toBeFalse();
    expect(raceEntryValidationError([swimmer('ana', 28.47)])).toBeNull();
  });

  it('rejects fabricated placings, duplicate participants and sub-hundredth times', () => {
    for (const entries of [
      [],
      [swimmer('ana', 28.47, 1)],
      [swimmer('ana', 28.473)],
      [swimmer('ana', -1)],
      [swimmer('ana', 0)],
      [swimmer('ana', 28.47), swimmer(' ANA ', 27.01)]
    ]) {
      expect(swimmingTimeError(entries)).toBeTrue();
    }
    const invalid = swimmer('ana', 28.40);
    invalid.bestLapSeconds = 27.1;
    expect(swimmingTimeError([invalid])).toBeTrue();
  });
});
