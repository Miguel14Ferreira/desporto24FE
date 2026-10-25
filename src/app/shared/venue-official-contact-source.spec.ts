import { Venue } from '../pages/model/venue';
import { venueOfficialContactPage } from './venue-official-contact-source';

describe('venueOfficialContactPage', () => {
  const candidate = (id: number, name: string, overrides: Partial<Venue> = {}) =>
    ({ id, name, city: 'Porto', district: 'Porto', contact: null, ...overrides } as Venue);

  it('links two official operator facility pages only for exact Jynlo identities', () => {
    expect(venueOfficialContactPage(candidate(261, 'Piscina Municipal da Constituição')))
      .toBe('https://www.agoraporto.pt/piscinas-municipais/piscina-municipal-da-constituicao');
    expect(venueOfficialContactPage(candidate(2654, 'Piscina Municipal de Cartes')))
      .toBe('https://www.agoraporto.pt/piscinas-municipais/piscina-municipal-de-cartes');
  });

  it('never promotes Armando Pimentel review-only name hints to official venue links', () => {
    expect(venueOfficialContactPage(candidate(2655, 'Piscinas Engenheiro Armando Pimentel'))).toBeNull();
  });

  it('refuses unrelated, renamed, moved or unconfirmed catalogue records', () => {
    expect(venueOfficialContactPage(candidate(999, 'Piscina Municipal da Constituição'))).toBeNull();
    expect(venueOfficialContactPage(candidate(261, 'Piscina Municipal de Cartes'))).toBeNull();
    expect(venueOfficialContactPage(candidate(261, 'Piscina Municipal da Constituição',
      { city: 'Vila Nova de Gaia' }))).toBeNull();
    expect(venueOfficialContactPage(candidate(261, 'Piscina Municipal da Constituição',
      { district: 'Lisboa' }))).toBeNull();
    expect(venueOfficialContactPage(candidate(261, 'Piscina Municipal da Constituição',
      { contact: '225073300' }))).toBeNull();
    expect(venueOfficialContactPage(null)).toBeNull();
    expect(venueOfficialContactPage(candidate(0, 'Piscina Municipal da Constituição'))).toBeNull();
  });

  it('accepts harmless Unicode accent and spacing variations only', () => {
    expect(venueOfficialContactPage(candidate(261, '  piscina municipal da constituicao  ')))
      .toBe('https://www.agoraporto.pt/piscinas-municipais/piscina-municipal-da-constituicao');
  });
});
