import { eventOptionsForSport, eventPresentationFormat } from './community-round-event-type';
import { athleticsDisciplineOptions, athleticsDisciplineValid } from './community-field-disciplines';
import { performanceKind, performanceError, eventPerformanceEntries,
  eventPerformancePlace, performanceDisplay } from './community-performance-results';
import { CommunityRoundEntry } from '../model/community-group';

describe('Rhythmic apparatus and artistic swimming solo', () => {
  it('requires a rhythmic apparatus, never shares apparatus with artistic gymnastics', () => {
    expect(eventOptionsForSport('Ginástica Rítmica').map(v => v.code))
      .toEqual(['RHYTHMIC_APPARATUS', 'RHYTHMIC_GROUP_5', 'RHYTHMIC_GROUP_3_2']);
    expect(athleticsDisciplineOptions('Ginástica Rítmica', 'RHYTHMIC_APPARATUS'))
      .toEqual(['HOOP', 'BALL', 'CLUBS', 'RIBBON']);
    expect(athleticsDisciplineValid('Ginástica Rítmica', 'RHYTHMIC_APPARATUS', null)).toBeFalse();
    expect(athleticsDisciplineValid('Ginástica Rítmica', 'RHYTHMIC_APPARATUS', 'BALL')).toBeTrue();
    expect(athleticsDisciplineValid('Ginástica Artística', 'APPARATUS', 'BALL')).toBeFalse();
    expect(performanceKind('RHYTHMIC_APPARATUS')).toBe('rhythmic');
    expect(performanceError('RHYTHMIC_APPARATUS', [{performanceValue: 35.625}])).toBeFalse();
    expect(performanceError('RHYTHMIC_APPARATUS', [{performanceValue: 35.6251}])).toBeTrue();
  });
  it('preserves four decimals for distinct artistic solo routines', () => {
    expect(eventOptionsForSport('Natação Artística').map(v => v.code))
      .toEqual(['ARTISTIC_SOLO_TECHNICAL','ARTISTIC_SOLO_FREE',
        'ARTISTIC_DUET_TECH', 'ARTISTIC_DUET_FREE',
        'ARTISTIC_TEAM_TECH', 'ARTISTIC_TEAM_FREE']);
    expect(eventPresentationFormat('Natação Artística','ARTISTIC_SOLO_TECHNICAL')).toBe('judged');
    expect(performanceKind('ARTISTIC_SOLO_FREE')).toBe('artistic');
    expect(performanceError('ARTISTIC_SOLO_FREE', [{performanceValue: 180.1234}])).toBeFalse();
    expect(performanceError('ARTISTIC_SOLO_FREE', [{performanceValue: 180.12345}])).toBeTrue();
    expect(performanceError('ARTISTIC_SOLO_TECHNICAL', [{performanceValue: -1}])).toBeTrue();
    expect(performanceError('ARTISTIC_SOLO_TECHNICAL', [{performanceValue: null}])).toBeFalse();
    expect(performanceError('FREESTYLE', [{performanceValue: 85.1234}])).toBeTrue();
    expect(performanceDisplay(180.1234,4)).toContain('1234');
  });
  it('ranks only the recorded routine, including ties and unscored participants', () => {
    const a={performanceValue: 180.1234} as CommunityRoundEntry;
    const b={performanceValue: 180.1234} as CommunityRoundEntry;
    const c={performanceValue: 170.1234} as CommunityRoundEntry;
    const missing={performanceValue: null} as CommunityRoundEntry;
    const round={eventType:'ARTISTIC_SOLO_FREE',entries:[c,a,missing,b]} as any;
    const sorted=eventPerformanceEntries(round);
    expect(sorted).toEqual([a,b,c,missing]);
    expect(eventPerformancePlace(sorted,b)).toBe(1);
    expect(eventPerformancePlace(sorted,c)).toBe(3);
    expect(eventPerformancePlace(sorted,missing)).toBeNull();
  });
});
