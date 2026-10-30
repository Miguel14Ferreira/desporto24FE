import { eventOptionsForSport, eventPresentationFormat, eventView,
  isRaceEvent, isNeutralEvent } from './community-round-event-type';
import { athleticsDisciplineOptions, athleticsDisciplineValid } from './community-field-disciplines';
import { formatOpenWaterTime, openWaterTimeError } from './community-open-water-results';
import { raceEntryValidationError } from './community-race-metrics';
import { CommunityRoundEntryDraft } from '../model/community-group';

describe('Natação em Águas Abertas — 5km/10km individual', () => {
  const swimmer = (username: string, time: number | null = null, place: number | null = null) =>
    ({ username, included: true, team: '', result: 'DRAW',
      goals: 0, assists: 0, mvp: false, cleanSheet: false,
      elapsedSeconds: time, finishPosition: place,
      bestLapSeconds: null, lapsCompleted: null,
      performanceValue: null, waveScore1: null, waveScore2: null } as CommunityRoundEntryDraft);

  it('limits selections to existing open-water sport and individual distances', () => {
    expect(eventOptionsForSport('Natação em Águas Abertas').map(x => x.code))
      .toEqual(['OWS_INDIVIDUAL']);
    expect(eventOptionsForSport('Natação').map(x => x.code)).toEqual(['SWIM_LCM']);
    expect(athleticsDisciplineOptions('Natação em Águas Abertas', 'OWS_INDIVIDUAL'))
      .toEqual(['OWS_5K', 'OWS_10K']);
    expect(athleticsDisciplineValid('Natação em Águas Abertas', 'OWS_INDIVIDUAL', 'OWS_5K'))
      .toBeTrue();
    expect(athleticsDisciplineValid('Natação em Águas Abertas', 'OWS_INDIVIDUAL', null))
      .toBeFalse();
    expect(athleticsDisciplineValid('Natação em Águas Abertas', 'OWS_INDIVIDUAL', 'OWS_RELAY'))
      .toBeFalse();
    expect(athleticsDisciplineValid('Natação em Águas Abertas', 'OWS_INDIVIDUAL', 'FREE_100'))
      .toBeFalse();
    expect(eventOptionsForSport('Natação Artística').some(x => x.code === 'OWS_INDIVIDUAL'))
      .toBeFalse();
  });

  it('uses time-only event rendering without changing untyped historical races', () => {
    expect(isRaceEvent('Natação em Águas Abertas', 'OWS_INDIVIDUAL')).toBeTrue();
    expect(isRaceEvent('Natação em Águas Abertas', null)).toBeTrue();
    expect(isNeutralEvent('Natação em Águas Abertas', 'OWS_INDIVIDUAL')).toBeFalse();
    expect(eventView('Natação em Águas Abertas', 'OWS_INDIVIDUAL')).toBe('race');
    expect(eventView('Natação em Águas Abertas', null)).toBe('race');
    expect(eventPresentationFormat('Natação em Águas Abertas', 'OWS_INDIVIDUAL')).toBe('race');
    expect(formatOpenWaterTime(3750.4)).toBe('1:02:30.4');
    expect(formatOpenWaterTime(3599.9)).toBe('59:59.9');
    expect(formatOpenWaterTime(7200)).toBe('2:00:00.0');
    expect(formatOpenWaterTime(null)).toBeNull();
    expect(openWaterTimeError([swimmer('ana', 3750.4), swimmer('bruno', null)])).toBeFalse();
    expect(raceEntryValidationError([swimmer('ana', 3750.4)])).toBeNull();
  });

  it('rejects invalid tenth-second times, position fields, and duplicated swimmers', () => {
    for (const entries of [
      [],
      [swimmer('ana', 3750.4, 1)],
      [swimmer('ana', 3750.45)],
      [swimmer('ana', 0)],
      [swimmer('ana', -1)],
      [swimmer('ana', 3750.4), swimmer(' ANA ', 3720.2)]
    ]) expect(openWaterTimeError(entries)).toBeTrue();
    const invalid = swimmer('ana', 3600.1);
    invalid.bestLapSeconds = 28.2;
    expect(openWaterTimeError([invalid])).toBeTrue();
  });
});
