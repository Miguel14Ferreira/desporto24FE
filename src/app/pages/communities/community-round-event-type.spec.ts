import { eventOptionsForSport, eventView, isRaceEvent, isNeutralEvent,
  eventPresentationFormat } from './community-round-event-type';

describe('multi-format sports should not reuse unrelated scoring rules', () => {
  it('requires choosing from the allowed variants of selected sports', () => {
    expect(eventOptionsForSport('BMX').map(o => o.code)).toEqual(['RACE', 'FREESTYLE']);
    expect(eventOptionsForSport('Atletismo').map(o => o.code)).toEqual(['TRACK', 'JUMP', 'THROW']);
    expect(eventOptionsForSport('Snowboard').map(o => o.code)).toEqual(['RACE', 'FREESTYLE']);
    expect(eventOptionsForSport('Futebol')).toEqual([]);
    expect(eventOptionsForSport('Surf').map(o => o.code)).toEqual(['HEAT']);
    expect(eventOptionsForSport('Ginástica Artística').map(o => o.code)).toEqual(['APPARATUS']);
  });
  it('treats freestyle and field event results as participation-only', () => {
    expect(isRaceEvent('BMX', 'FREESTYLE')).toBeFalse();
    expect(isRaceEvent('Atletismo', 'JUMP')).toBeFalse();
    expect(isNeutralEvent('Atletismo', 'THROW')).toBeTrue();
    expect(eventPresentationFormat('BMX', 'FREESTYLE')).toBe('judged');
    expect(eventPresentationFormat('Surf', 'HEAT')).toBe('judged');
    expect(eventPresentationFormat('Ginástica Artística', 'APPARATUS')).toBe('judged');
    expect(eventPresentationFormat('Atletismo', 'JUMP')).toBe('measured');
    expect(eventView('BMX', 'FREESTYLE')).toBe('individual');
    expect(eventView('Atletismo', 'TRACK')).toBe('race');
    expect(eventView('Snowboard', 'RACE')).toBe('race');
  });
  it('preserves old BMX races while keeping other old results neutral', () => {
    expect(eventView('BMX', null)).toBe('race');
    expect(eventView('Atletismo', null)).toBe('individual');
    expect(eventView('Snowboard', null)).toBe('individual');
    expect(eventView('Karting', null)).toBe('race');
    expect(eventView('Futsal', null)).toBe('team');
  });
});
