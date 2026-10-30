import { Venue } from '../pages/model/venue';
import { isVenueGpsOnly, venueLocationStatus, venuePostalAddress, venueUsableAddress } from './venue-location';

const partial = (values: Partial<Venue>): Venue => ({
  name: 'Campo de Teste', city: 'Coimbra', address: '',
  latitude: null, longitude: null, ...values
} as Venue);

describe('venue location quality', () => {
  it('detects OSM coordinates with no real postal address on older APIs', () => {
    const v = partial({ address: 'Localização no mapa: 40.2, -8.4 (morada por confirmar)',
      latitude: 40.2, longitude: -8.4 });
    expect(venueLocationStatus(v)).toBe('GPS_ONLY_ADDRESS_UNKNOWN');
    expect(isVenueGpsOnly(v)).toBeTrue();
    expect(venuePostalAddress(v)).toBeNull();
  });

  it('does not invent coordinates or a postal address from an unknown location', () => {
    const v = partial({ address: 'Morada por confirmar', latitude: null, longitude: null });
    expect(venueLocationStatus(v)).toBe('LOCATION_UNKNOWN');
    expect(venuePostalAddress(v)).toBeNull();
  });

  it('treats a supplied address as unverified, not independently confirmed', () => {
    const v = partial({ address: ' Rua António Sérgio, Coimbra ',
      latitude: 40.2, longitude: -8.4 });
    expect(venueLocationStatus(v)).toBe('ADDRESS_PROVIDED_UNVERIFIED');
    expect(venuePostalAddress(v)).toBe('Rua António Sérgio, Coimbra');
  });

  it('rejects map-coordinate placeholders as postal addresses', () => {
    for (const value of [
      'Localização no mapa: 40.2, -8.4', 'Coordenadas (morada por confirmar)',
      'Morada por confirmar', 'Map location: 40.2, -8.4', 'Address to be confirmed'
    ]) {
      expect(venueUsableAddress(value)).toBeNull();
    }
    expect(venueUsableAddress(' Rua do Recinto 12 ')).toBe('Rua do Recinto 12');
  });

  it('honours known new backend statuses', () => {
    const v = partial({ address: 'Localização no mapa: 40.2, -8.4',
      latitude: 40.2, longitude: -8.4,
      locationStatus: 'GPS_ONLY_ADDRESS_UNKNOWN' });
    expect(venuePostalAddress(v)).toBeNull();
  });
});
