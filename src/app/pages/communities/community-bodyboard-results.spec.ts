import { athleticsDisciplineOptions, athleticsDisciplineValid } from './community-field-disciplines';
import { eventOptionsForSport, eventPresentationFormat, eventView } from './community-round-event-type';
import {
  isWaveHeatEvent, surfWaveTotal, surfWaveError,
  eventPerformanceEntries, eventPerformancePlace, performanceError
} from './community-performance-results';
import { CommunityRoundEntry } from '../model/community-group';

describe('bodyboard heat records keep different sports and categories explicit', () => {
  it('uses an event type distinct from surf, separate from football and freestyle', () => {
    expect(eventOptionsForSport('Bodyboard').map(v => v.code)).toEqual(['BODYBOARD_HEAT']);
    expect(eventOptionsForSport('Surf').map(v => v.code)).toEqual(['HEAT']);
    expect(eventView('Bodyboard', 'BODYBOARD_HEAT')).toBe('individual');
    expect(eventPresentationFormat('Bodyboard', 'BODYBOARD_HEAT')).toBe('judged');
    expect(isWaveHeatEvent('BODYBOARD_HEAT')).toBeTrue();
    expect(isWaveHeatEvent('HEAT')).toBeTrue();
    expect(isWaveHeatEvent('FREESTYLE')).toBeFalse();
    expect(isWaveHeatEvent('APPARATUS')).toBeFalse();
    expect(performanceError('BODYBOARD_HEAT', [{ performanceValue: 15 }])).toBeTrue();
  });

  it('requires a prone/drop-knee category and excludes unsupported disciplines', () => {
    expect(athleticsDisciplineOptions('Bodyboard', 'BODYBOARD_HEAT')).toEqual(['PRONE', 'DROP_KNEE']);
    expect(athleticsDisciplineValid('Bodyboard', 'BODYBOARD_HEAT', 'PRONE')).toBeTrue();
    expect(athleticsDisciplineValid('Bodyboard', 'BODYBOARD_HEAT', 'DROP_KNEE')).toBeTrue();
    expect(athleticsDisciplineValid('Bodyboard', 'BODYBOARD_HEAT', null)).toBeFalse();
    expect(athleticsDisciplineValid('Bodyboard', 'BODYBOARD_HEAT', 'LONG_JUMP')).toBeFalse();
    expect(athleticsDisciplineValid('Surf', 'HEAT', 'DROP_KNEE')).toBeFalse();
  });

  it('orders only the selected heat; equal totals tie and unrecorded waves remain unscored', () => {
    const a = { waveScore1: 7.5, waveScore2: 6 } as CommunityRoundEntry;
    const b = { waveScore1: 8, waveScore2: 5.5 } as CommunityRoundEntry;
    const c = { waveScore1: 6, waveScore2: 5 } as CommunityRoundEntry;
    const missing = { waveScore1: null, waveScore2: null } as CommunityRoundEntry;
    const round = { eventType: 'BODYBOARD_HEAT', entries: [c, a, missing, b] } as any;
    const sorted = eventPerformanceEntries(round);
    expect(sorted).toEqual([a, b, c, missing]);
    expect(eventPerformancePlace(sorted, a, 'BODYBOARD_HEAT')).toBe(1);
    expect(eventPerformancePlace(sorted, b, 'BODYBOARD_HEAT')).toBe(1);
    expect(eventPerformancePlace(sorted, c, 'BODYBOARD_HEAT')).toBe(3);
    expect(eventPerformancePlace(sorted, missing, 'BODYBOARD_HEAT')).toBeNull();
    expect(surfWaveTotal(a)).toBe(13.5);
    expect(surfWaveTotal(missing)).toBeNull();
    expect(surfWaveError([{ waveScore1: 10, waveScore2: 0 }])).toBeFalse();
    expect(surfWaveError([{ waveScore1: 10.001, waveScore2: null }])).toBeTrue();
  });
});
