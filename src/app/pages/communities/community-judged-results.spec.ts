import {
  eventPerformanceEntries, eventPerformancePlace, performanceError,
  performanceKind, surfWaveError, surfWaveTotal
} from './community-performance-results';
import { CommunityRoundEntry } from '../model/community-group';

describe('surf heats and gym apparatus scored only within their events', () => {
  it('calculates transparent sums of already-judged surf waves', () => {
    expect(surfWaveTotal({ waveScore1: 7.25, waveScore2: 8.6 })).toBe(15.85);
    expect(surfWaveTotal({ waveScore1: null, waveScore2: null })).toBeNull();
    expect(surfWaveTotal({ waveScore1: 0, waveScore2: null })).toBe(0);
    expect(surfWaveError([{ waveScore1: 10, waveScore2: 0 }])).toBeFalse();
    expect(surfWaveError([{ waveScore1: 10.001, waveScore2: null }])).toBeTrue();
    expect(surfWaveError([{ waveScore1: 5, waveScore2: -1 }])).toBeTrue();
    expect(surfWaveError([{ waveScore1: 5, waveScore2: 1.1234 }])).toBeTrue();
  });
  it('keeps heat rankings isolated with ties and missing marks', () => {
    const a = { waveScore1: 8, waveScore2: 7 } as CommunityRoundEntry;
    const b = { waveScore1: 7.5, waveScore2: 7.5 } as CommunityRoundEntry;
    const c = { waveScore1: 6, waveScore2: 4 } as CommunityRoundEntry;
    const missing = { waveScore1: null, waveScore2: null } as CommunityRoundEntry;
    const round = { eventType: 'HEAT', entries: [c, a, missing, b] } as any;
    const sorted = eventPerformanceEntries(round);
    expect(sorted).toEqual([a, b, c, missing]);
    expect(eventPerformancePlace(sorted, a, 'HEAT')).toBe(1);
    expect(eventPerformancePlace(sorted, b, 'HEAT')).toBe(1);
    expect(eventPerformancePlace(sorted, c, 'HEAT')).toBe(3);
    expect(eventPerformancePlace(sorted, missing, 'HEAT')).toBeNull();
  });
  it('accepts gym final scores without assigning per-judge totals', () => {
    expect(performanceKind('APPARATUS')).toBe('gym');
    expect(performanceError('APPARATUS', [{ performanceValue: 15.625 }])).toBeFalse();
    expect(performanceError('APPARATUS', [{ performanceValue: 100.1 }])).toBeTrue();
    expect(performanceError('HEAT', [{ performanceValue: 4 }])).toBeTrue();
  });
});
