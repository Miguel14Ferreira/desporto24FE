import { eventOptionsForSport, eventPresentationFormat, eventView,
  isRaceEvent, isNeutralEvent } from './community-round-event-type';
import { athleticsDisciplineOptions, athleticsDisciplineValid } from './community-field-disciplines';
import { formatOrienteeringTime, orienteeringTimeError } from './community-orienteering-results';
import { raceEntryValidationError } from './community-race-metrics';
import { CommunityRoundEntryDraft } from '../model/community-group';

describe('Orientação — individual foot Sprint/Middle/Long', () => {
  const runner = (username: string, seconds: number | null = null, place: number | null = null) =>
    ({ username, included: true, team: '', result: 'DRAW',
      goals: 0, assists: 0, mvp: false, cleanSheet: false,
      elapsedSeconds: seconds, finishPosition: place,
      bestLapSeconds: null, lapsCompleted: null,
      performanceValue: null, waveScore1: null, waveScore2: null } as CommunityRoundEntryDraft);

  it('offers formats only for the confirmed existing Orientação sport', () => {
    expect(eventOptionsForSport('Orientação').map(option => option.code))
      .toEqual(['FOOT_ORIENTEERING']);
    expect(athleticsDisciplineOptions('Orientação', 'FOOT_ORIENTEERING'))
      .toEqual(['ORIENT_SPRINT', 'ORIENT_MIDDLE', 'ORIENT_LONG']);
    expect(athleticsDisciplineValid('Orientação', 'FOOT_ORIENTEERING', 'ORIENT_SPRINT'))
      .toBeTrue();
    expect(athleticsDisciplineValid('Orientação', 'FOOT_ORIENTEERING', null)).toBeFalse();
    expect(athleticsDisciplineValid('Orientação', 'FOOT_ORIENTEERING', 'ORIENT_RELAY'))
      .toBeFalse();
    expect(athleticsDisciplineValid('Orientação', 'FOOT_ORIENTEERING', 'OWS_5K'))
      .toBeFalse();
    expect(eventOptionsForSport('Natação em Águas Abertas').map(option => option.code))
      .toEqual(['OWS_INDIVIDUAL']);
  });

  it('keeps historic generic races visible, without reinterpreting typed courses', () => {
    expect(isRaceEvent('Orientação', 'FOOT_ORIENTEERING')).toBeTrue();
    expect(isRaceEvent('Orientação', null)).toBeTrue();
    expect(isNeutralEvent('Orientação', 'FOOT_ORIENTEERING')).toBeFalse();
    expect(eventView('Orientação', 'FOOT_ORIENTEERING')).toBe('race');
    expect(eventView('Orientação', null)).toBe('race');
    expect(eventPresentationFormat('Orientação', 'FOOT_ORIENTEERING')).toBe('race');
    expect(formatOrienteeringTime(735)).toBe('12:15');
    expect(formatOrienteeringTime(3735)).toBe('1:02:15');
    expect(formatOrienteeringTime(7200)).toBe('2:00:00');
    expect(formatOrienteeringTime(null)).toBeNull();
    expect(orienteeringTimeError([runner('ana', 735), runner('bruno', null)])).toBeFalse();
    expect(raceEntryValidationError([runner('ana', 735)])).toBeNull();
  });

  it('does not fabricate placings or accept incompatible metrics', () => {
    for (const entries of [
      [],
      [runner('ana', 735, 1)],
      [runner('ana', 735.5)],
      [runner('ana', 0)],
      [runner('ana', -1)],
      [runner('ana', 735), runner(' ANA ', 801)]
    ]) expect(orienteeringTimeError(entries)).toBeTrue();
    const invalid = runner('ana', 735);
    invalid.bestLapSeconds = 400;
    expect(orienteeringTimeError([invalid])).toBeTrue();
  });
});
