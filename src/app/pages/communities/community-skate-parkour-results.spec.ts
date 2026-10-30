import {
  eventOptionsForSport, eventView, isRaceEvent, isNeutralEvent, eventPresentationFormat
} from './community-round-event-type';
import {
  performanceKind, performanceError, eventPerformanceEntries, eventPerformancePlace
} from './community-performance-results';
import { raceSupportsLaps, raceEntryValidationError } from './community-race-metrics';
import { CommunityRoundEntry } from '../model/community-group';

describe('Skate and Parkour results are event-specific', () => {
  it('distinguishes judged Skate from Parkour Speed and Freestyle', () => {
    expect(eventOptionsForSport('Skate').map(x => x.code)).toEqual(['SKATE_PARK', 'SKATE_STREET']);
    expect(eventOptionsForSport('Parkour').map(x => x.code))
      .toEqual(['PARKOUR_SPEED', 'PARKOUR_FREESTYLE']);
    expect(eventOptionsForSport('Futebol')).toEqual([]);
    expect(eventView('Parkour', 'PARKOUR_SPEED')).toBe('race');
    expect(isRaceEvent('Parkour', 'PARKOUR_SPEED')).toBeTrue();
    expect(isNeutralEvent('Parkour', 'PARKOUR_SPEED')).toBeFalse();
    expect(isNeutralEvent('Parkour', 'PARKOUR_FREESTYLE')).toBeTrue();
    expect(eventView('Skate', 'SKATE_PARK')).toBe('individual');
    expect(eventPresentationFormat('Skate', 'SKATE_STREET')).toBe('judged');
    expect(eventPresentationFormat('Parkour', 'PARKOUR_FREESTYLE')).toBe('judged');
    expect(eventView('Skate', null)).toBe('individual'); // historical rounds unchanged
  });

  it('validates each manually supplied judge score without deriving run/trick totals', () => {
    expect(performanceKind('SKATE_PARK')).toBe('points');
    expect(performanceKind('SKATE_STREET')).toBe('street');
    expect(performanceKind('PARKOUR_FREESTYLE')).toBe('points');
    expect(performanceKind('PARKOUR_SPEED')).toBeNull();
    expect(performanceError('SKATE_PARK', [{ performanceValue: 100 }])).toBeFalse();
    expect(performanceError('SKATE_PARK', [{ performanceValue: 100.001 }])).toBeTrue();
    expect(performanceError('SKATE_STREET', [{ performanceValue: 275.125 }])).toBeFalse();
    expect(performanceError('SKATE_STREET', [{ performanceValue: 300.001 }])).toBeTrue();
    expect(performanceError('PARKOUR_FREESTYLE', [{ performanceValue: 83.375 }])).toBeFalse();
    expect(performanceError('PARKOUR_FREESTYLE', [{ performanceValue: -1 }])).toBeTrue();
    expect(performanceError('PARKOUR_SPEED', [{ performanceValue: 15 }])).toBeTrue();
    expect(performanceError('SKATE_PARK', [{ performanceValue: null }])).toBeFalse();
  });

  it('only sorts recorded values within the same event, preserving ties and missing marks', () => {
    const a = { performanceValue: 88.5 } as CommunityRoundEntry;
    const b = { performanceValue: 88.5 } as CommunityRoundEntry;
    const c = { performanceValue: 75 } as CommunityRoundEntry;
    const missing = { performanceValue: null } as CommunityRoundEntry;
    const round = { sport: 'Skate', eventType: 'SKATE_PARK',
      entries: [missing, c, a, b] } as any;
    const sorted = eventPerformanceEntries(round);
    expect(sorted).toEqual([a, b, c, missing]);
    expect(eventPerformancePlace(sorted, a)).toBe(1);
    expect(eventPerformancePlace(sorted, b)).toBe(1);
    expect(eventPerformancePlace(sorted, c)).toBe(3);
    expect(eventPerformancePlace(sorted, missing)).toBeNull();
  });

  it('Parkour Speed has timed results, never track lap fields', () => {
    expect(raceSupportsLaps('Parkour')).toBeFalse();
    expect(raceEntryValidationError([
      { finishPosition: 1, elapsedSeconds: 24.5, bestLapSeconds: null, lapsCompleted: null }
    ])).toBeNull();
    expect(raceEntryValidationError([
      { finishPosition: 1, elapsedSeconds: 0, bestLapSeconds: null, lapsCompleted: null }
    ])).toBe('raceInvalidMetrics');
  });
});
