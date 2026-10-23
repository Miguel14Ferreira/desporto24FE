import { eventOptionsForSport, eventView, isRaceEvent, isNeutralEvent,
  eventPresentationFormat } from './community-round-event-type';

describe('multi-format sports should not reuse unrelated scoring rules', () => {
  it('requires choosing from the allowed variants of selected sports', () => {
    expect(eventOptionsForSport('BMX').map(o => o.code)).toEqual(['RACE', 'FREESTYLE']);
    expect(eventOptionsForSport('Atletismo').map(o => o.code)).toEqual(['TRACK', 'JUMP', 'THROW']);
    expect(eventOptionsForSport('Snowboard').map(o => o.code)).toEqual(['RACE', 'FREESTYLE']);
    expect(eventOptionsForSport('Futebol')).toEqual([]);
    expect(eventOptionsForSport('Surf').map(o => o.code)).toEqual(['HEAT']);
    expect(eventOptionsForSport('Bodyboard').map(o => o.code)).toEqual(['BODYBOARD_HEAT']);
    expect(eventOptionsForSport('Skate').map(o => o.code)).toEqual(['SKATE_PARK', 'SKATE_STREET']);
    expect(eventOptionsForSport('Parkour').map(o => o.code))
      .toEqual(['PARKOUR_SPEED', 'PARKOUR_FREESTYLE']);
    expect(eventOptionsForSport('Ginástica Artística').map(o => o.code)).toEqual(['APPARATUS']);
    expect(eventOptionsForSport('Breaking').map(o => o.code)).toEqual(['BREAKING_BATTLE']);
    expect(eventOptionsForSport('Trampolim').map(o => o.code)).toEqual(['TRAMPOLINE_INDIVIDUAL']);
  });
  it('treats freestyle and field event results as participation-only', () => {
    expect(isRaceEvent('BMX', 'FREESTYLE')).toBeFalse();
    expect(isRaceEvent('Atletismo', 'JUMP')).toBeFalse();
    expect(isNeutralEvent('Atletismo', 'THROW')).toBeTrue();
    expect(eventPresentationFormat('BMX', 'FREESTYLE')).toBe('judged');
    expect(eventPresentationFormat('Surf', 'HEAT')).toBe('judged');
    expect(eventPresentationFormat('Bodyboard', 'BODYBOARD_HEAT')).toBe('judged');
    expect(eventPresentationFormat('Ginástica Artística', 'APPARATUS')).toBe('judged');
    expect(eventPresentationFormat('Atletismo', 'JUMP')).toBe('measured');
    expect(eventView('BMX', 'FREESTYLE')).toBe('individual');
    expect(eventView('Atletismo', 'TRACK')).toBe('race');
    expect(eventView('Snowboard', 'RACE')).toBe('race');
    expect(eventView('Bodyboard', 'BODYBOARD_HEAT')).toBe('individual');
    expect(eventView('Parkour', 'PARKOUR_SPEED')).toBe('race');
    expect(eventView('Parkour', 'PARKOUR_FREESTYLE')).toBe('individual');
    expect(eventPresentationFormat('Skate', 'SKATE_PARK')).toBe('judged');
    expect(eventPresentationFormat('Skate', 'SKATE_STREET')).toBe('judged');
    expect(eventPresentationFormat('Parkour', 'PARKOUR_SPEED')).toBe('race');
    expect(eventPresentationFormat('Breaking', 'BREAKING_BATTLE')).toBe('judged');
    expect(eventPresentationFormat('Trampolim', 'TRAMPOLINE_INDIVIDUAL')).toBe('judged');
    expect(isNeutralEvent('Breaking', 'BREAKING_BATTLE')).toBeTrue();
    expect(isNeutralEvent('Trampolim', 'TRAMPOLINE_INDIVIDUAL')).toBeTrue();
    expect(eventView('Breaking', 'BREAKING_BATTLE')).toBe('individual');
  });
  it('preserves old BMX races while keeping other old results neutral', () => {
    expect(eventView('BMX', null)).toBe('race');
    expect(eventView('Atletismo', null)).toBe('individual');
    expect(eventView('Snowboard', null)).toBe('individual');
    expect(eventView('Karting', null)).toBe('race');
    expect(eventView('Futsal', null)).toBe('team');
  });
});
