import {
  eventPerformanceEntries, eventPerformancePlace, performanceError, performanceKind
} from './community-performance-results';
import { CommunityRoundEntry } from '../model/community-group';

describe('community results for measured and judged events', () => {
  it('distinguishes metres from an aggregate jury score', () => {
    expect(performanceKind('JUMP')).toBe('metres');
    expect(performanceKind('THROW')).toBe('metres');
    expect(performanceKind('FREESTYLE')).toBe('points');
    expect(performanceKind('RACE')).toBeNull();
  });
  it('validates event marks, leaving participants without marks untouched', () => {
    expect(performanceError('JUMP', [{ performanceValue: 6.32 }, { performanceValue: null }])).toBeFalse();
    expect(performanceError('JUMP', [{ performanceValue: 0 }])).toBeTrue();
    expect(performanceError('JUMP', [{ performanceValue: -1 }])).toBeTrue();
    expect(performanceError('THROW', [{ performanceValue: 25.1234 }])).toBeTrue();
    expect(performanceError('FREESTYLE', [{ performanceValue: 0 }])).toBeFalse();
    expect(performanceError('FREESTYLE', [{ performanceValue: 100 }])).toBeFalse();
    expect(performanceError('FREESTYLE', [{ performanceValue: 100.001 }])).toBeTrue();
    expect(performanceError('RACE', [{ performanceValue: 8 }])).toBeTrue();
  });
  it('ranks only one event, shares tied places, never invents missing marks', () => {
    const a = { performanceValue: 6.1 } as CommunityRoundEntry;
    const b = { performanceValue: 6.2 } as CommunityRoundEntry;
    const c = { performanceValue: 6.2 } as CommunityRoundEntry;
    const missing = { performanceValue: null } as CommunityRoundEntry;
    const round = { entries: [a, b, missing, c] } as any;
    const sorted = eventPerformanceEntries(round);
    expect(sorted).toEqual([b, c, a, missing]);
    expect(eventPerformancePlace(sorted, b)).toBe(1);
    expect(eventPerformancePlace(sorted, c)).toBe(1);
    expect(eventPerformancePlace(sorted, a)).toBe(3);
    expect(eventPerformancePlace(sorted, missing)).toBeNull();
  });
});
