import { eventOptionsForSport, eventPresentationFormat, isNeutralEvent }
  from './community-round-event-type';
import { performanceKind, performanceError, eventPerformanceEntries, eventPerformancePlace }
  from './community-performance-results';
import { CommunityRound, CommunityRoundEntry } from '../model/community-group';

describe('Golf — typed gross stroke play', () => {
  const player = (username: string, strokes: number | null) =>
    ({ username, performanceValue: strokes } as CommunityRoundEntry);

  it('allows the existing Golfe discipline with 9 and 18 hole formats only', () => {
    expect(eventOptionsForSport('Golfe').map(x=>x.code))
      .toEqual(['GOLF_STROKE_9', 'GOLF_STROKE_18']);
    expect(eventOptionsForSport('Futebol')).toEqual([]);
    expect(isNeutralEvent('Golfe', 'GOLF_STROKE_18')).toBeTrue();
    expect(eventPresentationFormat('Golfe', 'GOLF_STROKE_9')).toBe('score');
    expect(performanceKind('GOLF_STROKE_18')).toBe('golf');
  });

  it('requires integer gross totals for every participant, with hole-aware minimums', () => {
    expect(performanceError('GOLF_STROKE_9', [{performanceValue: 35}])).toBeFalse();
    expect(performanceError('GOLF_STROKE_18', [{performanceValue: 72}])).toBeFalse();
    for (const invalid of [null, 0, 17, 70.5, -1, 1000000, Infinity, NaN]) {
      expect(performanceError('GOLF_STROKE_18', [{performanceValue: invalid}]))
        .toBeTrue();
    }
    expect(performanceError('GOLF_STROKE_9', [{performanceValue: 8}])).toBeTrue();
    expect(performanceError('GOLF_STROKE_18', [{performanceValue: 18}])).toBeFalse();
    expect(performanceError('JUMP', [{performanceValue: null}])).toBeFalse();
  });

  it('sorts lower scores first, shares ties and does not invent official winners', () => {
    const a = player('a', 72), b = player('b', 69), c = player('c', 69);
    const round = {eventType:'GOLF_STROKE_18', entries:[a,c,b]} as CommunityRound;
    const sorted = eventPerformanceEntries(round);
    expect(sorted).toEqual([c,b,a]);
    expect(eventPerformancePlace(sorted,c,round.eventType)).toBe(1);
    expect(eventPerformancePlace(sorted,b,round.eventType)).toBe(1);
    expect(eventPerformancePlace(sorted,a,round.eventType)).toBe(3);
    const nonGolf = {eventType:'APPARATUS', entries:[a,c,b]} as CommunityRound;
    expect(eventPerformanceEntries(nonGolf)[0]).toBe(a);
  });
});
