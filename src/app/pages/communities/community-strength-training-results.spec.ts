import { eventOptionsForSport, eventPresentationFormat, eventView, isNeutralEvent,
  isRaceEvent } from './community-round-event-type';
import { performanceError, performanceKind } from './community-performance-results';
import { CommunityRoundEntryDraft } from '../model/community-group';

describe('Musculação — participation-only strength training', () => {
  const participant = (username: string, score: number | null = null) =>
    ({ username, included: true, team: '', result: 'DRAW', goals: 0, assists: 0,
      mvp: false, cleanSheet: false, performanceValue: score, waveScore1: null,
      waveScore2: null } as CommunityRoundEntryDraft);

  it('supports only the existing Musculação catalog entry', () => {
    expect(eventOptionsForSport('Musculação').map(option => option.code))
      .toEqual(['STRENGTH_TRAINING']);
    expect(eventOptionsForSport('Yoga')).toEqual([]);
    expect(eventOptionsForSport('Futebol')).toEqual([]);
    expect(eventPresentationFormat('Musculação', 'STRENGTH_TRAINING')).toBe('activity');
    expect(eventView('Musculação', 'STRENGTH_TRAINING')).toBe('individual');
    expect(isNeutralEvent('Musculação', 'STRENGTH_TRAINING')).toBeTrue();
    expect(isRaceEvent('Musculação', 'STRENGTH_TRAINING')).toBeFalse();
  });

  it('records participants without scorecards, rankings or invented numeric results', () => {
    expect(performanceKind('STRENGTH_TRAINING')).toBeNull();
    expect(performanceError('STRENGTH_TRAINING', [
      participant('ana'), participant('bruno')])).toBeFalse();
    expect(performanceError('STRENGTH_TRAINING', [
      participant('ana', 100)])).toBeTrue();
  });

  it('does not reinterpret historical untyped training as a typed event', () => {
    expect(isNeutralEvent('Musculação', null)).toBeFalse();
    expect(eventOptionsForSport('Muay Thai').map(option => option.code))
      .toEqual(['IFMA_FULL_WP', 'IFMA_FULL_KO', 'IFMA_FULL_RSCS', 'IFMA_FULL_RSCI']);
  });
});
