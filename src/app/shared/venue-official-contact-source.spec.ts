import { Venue } from '../pages/model/venue';
import { venueOfficialContactPage, venueOfficialContactPageNeedsIdentityCheck } from './venue-official-contact-source';

describe('venueOfficialContactPage', () => {
  const candidate = (id: number, name: string, overrides: Partial<Venue> = {}) =>
    ({ id, name, city: 'Porto', district: 'Porto', contact: null, ...overrides } as Venue);

  it('links two official operator facility pages only for exact Jynlo identities', () => {
    expect(venueOfficialContactPage(candidate(261, 'Piscina Municipal da Constituição')))
      .toBe('https://www.agoraporto.pt/piscinas-municipais/piscina-municipal-da-constituicao');
    expect(venueOfficialContactPage(candidate(2654, 'Piscina Municipal de Cartes')))
      .toBe('https://www.agoraporto.pt/piscinas-municipais/piscina-municipal-de-cartes');
  });

  it('offers an official operator page for the exact Armando Pimentel catalogue record with a warning', () => {
    const listed = candidate(2655, 'Piscinas Engenheiro Armando Pimentel', {
      address: 'Morada por confirmar'
    });
    expect(venueOfficialContactPage(listed))
      .toBe('https://www.agoraporto.pt/desporto/piscina-municipal-eng-o-armando-pimentel');
    expect(venueOfficialContactPageNeedsIdentityCheck(listed)).toBeTrue();
    expect(venueOfficialContactPageNeedsIdentityCheck(candidate(261, 'Piscina Municipal da Constituição'))).toBeFalse();
  });

  it('never treats a name hint, other city or preexisting contact as the exact Armando Pimentel source', () => {
    expect(venueOfficialContactPage(candidate(2655, 'Piscina Municipal Eng.º Armando Pimentel'))).toBeNull();
    expect(venueOfficialContactPage(candidate(2655, 'Piscinas Engenheiro Armando Pimentel',
      {city: 'Vila Nova de Gaia'}))).toBeNull();
    expect(venueOfficialContactPage(candidate(2655, 'Piscinas Engenheiro Armando Pimentel',
      {district: 'Lisboa'}))).toBeNull();
    expect(venueOfficialContactPage(candidate(2655, 'Piscinas Engenheiro Armando Pimentel',
      {contact: '+351 226 179 598'}))).toBeNull();
    expect(venueOfficialContactPageNeedsIdentityCheck(candidate(999, 'Piscinas Engenheiro Armando Pimentel'))).toBeFalse();
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
