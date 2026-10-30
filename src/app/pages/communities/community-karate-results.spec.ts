import { eventOptionsForSport, eventPresentationFormat, isNeutralEvent }
  from './community-round-event-type';
import { karateBoutError, isKarateEvent, isKarateKumite }
  from './community-karate-results';
import { CommunityRoundEntryDraft } from '../model/community-group';

describe('Karate 2026 — confirmed individual kumite and kata', () => {
  const player = (team: string, result: 'WIN'|'LOSS'|'DRAW', performanceValue: number|null = null) =>
    ({ team, result, performanceValue } as CommunityRoundEntryDraft);
  it('uses the existing Karaté sport, no invented disciplines', () => {
    expect(eventOptionsForSport('Karaté').map(x => x.code))
      .toEqual(['KARATE_KUMITE_POINTS','KARATE_KUMITE_SENSHU',
        'KARATE_KUMITE_HANTEI','KARATE_KATA_JUDGES']);
    expect(eventOptionsForSport('Futebol')).toEqual([]);
    expect(isKarateEvent('JUDO_IPPON')).toBeFalse();
    expect(isKarateKumite('KARATE_KATA_JUDGES')).toBeFalse();
    expect(eventPresentationFormat('Karaté','KARATE_KATA_JUDGES')).toBe('duel');
    expect(isNeutralEvent('Karaté','KARATE_KUMITE_POINTS')).toBeTrue();
  });
  it('requires two valid belt colours and exactly one winner', () => {
    expect(karateBoutError('KARATE_KUMITE_POINTS', [player('AKA','WIN',8),player('AO','LOSS',0)]))
      .toBeFalse();
    expect(karateBoutError('KARATE_KUMITE_POINTS', [player('AKA','LOSS',8),player('AO','WIN',0)]))
      .toBeTrue();
    expect(karateBoutError('KARATE_KUMITE_POINTS', [player('AKA','WIN',8),player('AKA','LOSS',0)]))
      .toBeTrue();
    expect(karateBoutError('KARATE_KUMITE_POINTS', [player('AKA','WIN',8)]))
      .toBeTrue();
    expect(karateBoutError('KARATE_KUMITE_POINTS', [player('AKA','WIN',8),player('AO','WIN',0)]))
      .toBeTrue();
  });
  it('does not allow missing, fractional or tied point victories', () => {
    for (const bad of [null,-1,3.4,1000000]) {
      expect(karateBoutError('KARATE_KUMITE_POINTS',[player('AKA','WIN',bad),player('AO','LOSS',0)]))
        .toBeTrue();
    }
    expect(karateBoutError('KARATE_KUMITE_POINTS',[player('AKA','WIN',1),player('AO','LOSS',1)]))
      .toBeTrue();
  });
  it('SENSHU and HANTEI require officially confirmed tied points', () => {
    expect(karateBoutError('KARATE_KUMITE_SENSHU',[player('AKA','LOSS',1),player('AO','WIN',1)]))
      .toBeFalse();
    expect(karateBoutError('KARATE_KUMITE_SENSHU',[player('AKA','WIN',0),player('AO','LOSS',0)]))
      .toBeTrue();
    expect(karateBoutError('KARATE_KUMITE_HANTEI',[player('AKA','WIN',0),player('AO','LOSS',0)]))
      .toBeFalse();
    expect(karateBoutError('KARATE_KUMITE_HANTEI',[player('AKA','WIN',2),player('AO','LOSS',1)]))
      .toBeTrue();
  });
  it('kata uses a confirmed judges decision not an invented aggregate score', () => {
    expect(karateBoutError('KARATE_KATA_JUDGES',[player('AKA','WIN'),player('AO','LOSS')]))
      .toBeFalse();
    expect(karateBoutError('KARATE_KATA_JUDGES',[player('AKA','WIN',8),player('AO','LOSS',9)]))
      .toBeTrue();
    expect(karateBoutError('KARATE_KATA_JUDGES',[player('AKA','DRAW'),player('AO','DRAW')]))
      .toBeTrue();
  });
});
