import { eventOptionsForSport, eventView, isRaceEvent, isNeutralEvent,
  eventPresentationFormat } from './community-round-event-type';

describe('multi-format sports should not reuse unrelated scoring rules', () => {
  it('requires choosing from the allowed variants of selected sports', () => {
    expect(eventOptionsForSport('BMX').map(o => o.code)).toEqual(['RACE', 'FREESTYLE']);
    expect(eventOptionsForSport('Ciclismo de Pista').map(o => o.code))
      .toEqual(['TRACK_SCRATCH', 'TRACK_TIME_TRIAL', 'TRACK_FLYING_200', 'TRACK_SPRINT_HEAT','TRACK_SPRINT_REPECHAGE','TRACK_SPRINT_5_8']);
    expect(isRaceEvent('Ciclismo de Pista', 'TRACK_SCRATCH')).toBeTrue();
    expect(isRaceEvent('Ciclismo de Pista', 'TRACK_SPRINT_5_8')).toBeTrue();
    expect(isRaceEvent('Ciclismo de Pista', 'TRACK_TIME_TRIAL')).toBeTrue();
    expect(isRaceEvent('Ciclismo de Pista', 'TRACK_FLYING_200')).toBeTrue();
    expect(isRaceEvent('Ciclismo de Pista', 'TRACK_SPRINT_HEAT')).toBeFalse();
    expect(isNeutralEvent('Ciclismo de Pista', 'TRACK_SPRINT_HEAT')).toBeTrue();
    expect(isNeutralEvent('Ciclismo de Estrada', 'TRACK_SPRINT_HEAT')).toBeFalse();
    expect(eventView('Ciclismo de Pista', 'TRACK_SPRINT_HEAT')).toBe('individual');
    expect(eventPresentationFormat('Ciclismo de Pista', 'TRACK_SPRINT_HEAT')).toBe('duel');
    expect(eventView('Ciclismo de Pista', 'TRACK_FLYING_200')).toBe('race');
    expect(eventPresentationFormat('Ciclismo de Pista', 'TRACK_FLYING_200')).toBe('race');
    expect(isRaceEvent('Ciclismo de Estrada', 'TRACK_FLYING_200')).toBeFalse();
    expect(isRaceEvent('Ciclismo de Pista', null)).toBeTrue(); // historic only
    expect(isRaceEvent('Ciclismo de Pista', 'TIME_TRIAL')).toBeFalse();
    expect(eventView('Ciclismo de Pista', null)).toBe('race');
    expect(eventView('Ciclismo de Pista', 'TRACK_TIME_TRIAL')).toBe('race');
    expect(eventOptionsForSport('Ciclismo de Estrada').map(o => o.code))
      .toEqual(['ROAD_RACE', 'TIME_TRIAL']);
    expect(isRaceEvent('Ciclismo de Estrada', 'ROAD_RACE')).toBeTrue();
    expect(isRaceEvent('Ciclismo de Estrada', 'TIME_TRIAL')).toBeTrue();
    expect(isRaceEvent('Ciclismo de Estrada', null)).toBeTrue();
    expect(isRaceEvent('Ciclismo de Estrada', 'TRACK')).toBeFalse();
    expect(eventView('Ciclismo de Estrada', null)).toBe('race');
    expect(eventPresentationFormat('Ciclismo de Estrada', 'TIME_TRIAL')).toBe('race');
    expect(eventOptionsForSport('Atletismo').map(o => o.code)).toEqual(['TRACK', 'JUMP', 'THROW']);
    expect(eventOptionsForSport('Snowboard').map(o => o.code)).toEqual(['RACE', 'FREESTYLE']);
    expect(eventOptionsForSport('Futebol')).toEqual([]);
    expect(eventOptionsForSport('Surf').map(o => o.code)).toEqual(['HEAT']);
    expect(eventOptionsForSport('Bodyboard').map(o => o.code)).toEqual(['BODYBOARD_HEAT']);
    expect(eventOptionsForSport('Basquetebol').map(o => o.code)).toEqual(['BASKETBALL_FINAL']);
    expect(eventOptionsForSport('Basquetebol 3x3').map(o => o.code)).toEqual(['BASKETBALL_3X3_FINAL']);
    expect(eventOptionsForSport('Voleibol').map(o => o.code)).toEqual(['VOLLEYBALL_FINAL']);
    expect(eventOptionsForSport('Voleibol de Praia').map(o => o.code)).toEqual(['BEACH_VOLLEY_FINAL']);
    expect(eventOptionsForSport('Skate').map(o => o.code)).toEqual(['SKATE_PARK', 'SKATE_STREET']);
    expect(eventOptionsForSport('Parkour').map(o => o.code))
      .toEqual(['PARKOUR_SPEED', 'PARKOUR_FREESTYLE']);
    expect(eventOptionsForSport('Ginástica Artística').map(o => o.code)).toEqual(['APPARATUS']);
    expect(eventOptionsForSport('Breaking').map(o => o.code)).toEqual(['BREAKING_BATTLE']);
    expect(eventOptionsForSport('Trampolim').map(o => o.code)).toEqual(['TRAMPOLINE_INDIVIDUAL']);
    expect(eventOptionsForSport('Ginástica Rítmica').map(o => o.code))
      .toEqual(['RHYTHMIC_APPARATUS', 'RHYTHMIC_GROUP_5', 'RHYTHMIC_GROUP_3_2']);
    expect(eventOptionsForSport('Natação Artística').map(o => o.code))
      .toEqual(['ARTISTIC_SOLO_TECHNICAL', 'ARTISTIC_SOLO_FREE',
        'ARTISTIC_DUET_TECH', 'ARTISTIC_DUET_FREE',
        'ARTISTIC_TEAM_TECH', 'ARTISTIC_TEAM_FREE']);
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
    expect(isNeutralEvent('Ginástica Rítmica', 'RHYTHMIC_APPARATUS')).toBeTrue();
    expect(isNeutralEvent('Natação Artística', 'ARTISTIC_SOLO_TECHNICAL')).toBeTrue();
    expect(eventPresentationFormat('Natação Artística', 'ARTISTIC_SOLO_FREE')).toBe('judged');
    expect(eventView('Natação Artística', 'ARTISTIC_SOLO_FREE')).toBe('individual');
    expect(eventView('Natação Artística', 'ARTISTIC_DUET_TECH')).toBe('individual');
    expect(isNeutralEvent('Ginástica Rítmica', 'RHYTHMIC_GROUP_5')).toBeTrue();
    expect(eventPresentationFormat('Natação Artística', 'ARTISTIC_TEAM_FREE')).toBe('judged');
  });
  it('preserves old BMX races while keeping other old results neutral', () => {
    expect(eventView('BMX', null)).toBe('race');
    expect(eventView('Atletismo', null)).toBe('individual');
    expect(eventView('Snowboard', null)).toBe('individual');
    expect(eventView('Karting', null)).toBe('race');
    expect(eventView('Futsal', null)).toBe('team');
    for (const sport of ['Andebol', 'Rugby', 'Rugby Sevens', 'Voleibol',
      'Voleibol de Praia', 'Basquetebol', 'Basquetebol 3x3',
      'Hóquei em Campo', 'Hóquei em Patins', 'Polo Aquático']) {
      expect(eventView(sport, null)).toBe('team');
    }
    expect(eventView('Futsal', 'FUTSAL_FINAL')).toBe('individual');
    expect(eventPresentationFormat('Futsal', 'FUTSAL_FINAL')).toBe('team');
  });
});
