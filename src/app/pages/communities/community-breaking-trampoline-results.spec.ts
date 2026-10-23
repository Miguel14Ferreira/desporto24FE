import { breakingBattleError } from './community-breaking-battle';
import { eventOptionsForSport, eventView, isNeutralEvent } from './community-round-event-type';
import { performanceKind, performanceError, eventPerformanceEntries,
  eventPerformancePlace } from './community-performance-results';
import { CommunityRoundEntry, CommunityRoundEntryDraft } from '../model/community-group';

const outcome = (result: 'WIN' | 'LOSS' | 'DRAW') =>
  ({ result } as Pick<CommunityRoundEntryDraft, 'result'>);

describe('Breaking battles and Trampoline individual results', () => {
  it('requires one winner and loser for a two-person battle, never judge points', () => {
    expect(eventOptionsForSport('Breaking').map(e => e.code)).toEqual(['BREAKING_BATTLE']);
    expect(eventOptionsForSport('Trampolim').map(e => e.code)).toEqual(['TRAMPOLINE_INDIVIDUAL']);
    expect(eventOptionsForSport('Futebol')).toEqual([]);
    expect(isNeutralEvent('Breaking', 'BREAKING_BATTLE')).toBeTrue();
    expect(eventView('Breaking', null)).toBe('individual');
    expect(breakingBattleError([outcome('WIN'), outcome('LOSS')])).toBeFalse();
    expect(breakingBattleError([outcome('LOSS'), outcome('WIN')])).toBeFalse();
    expect(breakingBattleError([outcome('WIN')])).toBeTrue();
    expect(breakingBattleError([outcome('WIN'), outcome('WIN')])).toBeTrue();
    expect(breakingBattleError([outcome('DRAW'), outcome('LOSS')])).toBeTrue();
    expect(breakingBattleError([outcome('WIN'), outcome('LOSS'), outcome('LOSS')])).toBeTrue();
    expect(performanceKind('BREAKING_BATTLE')).toBeNull();
    expect(performanceError('BREAKING_BATTLE', [{ performanceValue: 10 }])).toBeTrue();
  });

  it('Trampoline stores a final score without reconstructing FIG components', () => {
    expect(performanceKind('TRAMPOLINE_INDIVIDUAL')).toBe('trampoline');
    expect(performanceError('TRAMPOLINE_INDIVIDUAL', [{ performanceValue: null }])).toBeFalse();
    expect(performanceError('TRAMPOLINE_INDIVIDUAL', [{ performanceValue: 0 }])).toBeFalse();
    expect(performanceError('TRAMPOLINE_INDIVIDUAL', [{ performanceValue: 54.25 }])).toBeFalse();
    expect(performanceError('TRAMPOLINE_INDIVIDUAL', [{ performanceValue: 9999.99 }])).toBeFalse();
    expect(performanceError('TRAMPOLINE_INDIVIDUAL', [{ performanceValue: 55.123 }])).toBeTrue();
    expect(performanceError('TRAMPOLINE_INDIVIDUAL', [{ performanceValue: -1 }])).toBeTrue();
    expect(performanceError('TRAMPOLINE_INDIVIDUAL', [{ performanceValue: 10000 }])).toBeTrue();
    expect(performanceError('FREESTYLE', [{ performanceValue: 101 }])).toBeTrue();
  });

  it('Trampoline ties remain inside one event and missing scores never become zero', () => {
    const a = { performanceValue: 55.25 } as CommunityRoundEntry;
    const b = { performanceValue: 55.25 } as CommunityRoundEntry;
    const c = { performanceValue: 51.13 } as CommunityRoundEntry;
    const missing = { performanceValue: null } as CommunityRoundEntry;
    const round = { eventType: 'TRAMPOLINE_INDIVIDUAL',
      entries: [missing, c, a, b] } as any;
    const sorted = eventPerformanceEntries(round);
    expect(sorted).toEqual([a, b, c, missing]);
    expect(eventPerformancePlace(sorted, a)).toBe(1);
    expect(eventPerformancePlace(sorted, b)).toBe(1);
    expect(eventPerformancePlace(sorted, c)).toBe(3);
    expect(eventPerformancePlace(sorted, missing)).toBeNull();
  });
});
