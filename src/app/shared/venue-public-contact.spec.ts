import { venueHasMainlandCoordinates, venueHasPortugueseCoordinates, venueDirectionsUrl, venueOsmEmbedUrl, venueTelephoneUrl } from './venue-public-contact';

describe('public venue map/contact links', () => {
  it('embeds valid coordinates with an OSM marker and small surrounding area', () => {
    const src = venueOsmEmbedUrl(38.7223, -9.1393)!;
    expect(src).toContain('https://www.openstreetmap.org/export/embed.html?');
    expect(src).toContain('marker=38.7223%2C-9.1393');
    expect(src).toContain('bbox=-9.1433%2C38.7183%2C-9.1353%2C38.7263');
  });

  it('never builds an iframe URL using invalid or injected GPS values', () => {
    expect(venueOsmEmbedUrl(NaN, 2)).toBeNull();
    expect(venueOsmEmbedUrl(38.7, Infinity)).toBeNull();
    expect(venueOsmEmbedUrl(-91, 2)).toBeNull();
    expect(venueOsmEmbedUrl(38.7, 181)).toBeNull();
    expect(venueOsmEmbedUrl(Number('NaN'), -9.1)).toBeNull();
    expect(venueOsmEmbedUrl(0, 0)).toBeNull();
    expect(venueOsmEmbedUrl(38.72, -5.5)).toBeNull();
  });

  it('accepts only plausible mainland Portugal coordinates for precise venue pins', () => {
    expect(venueHasMainlandCoordinates(38.7223, -9.1393)).toBeTrue();
    expect(venueHasMainlandCoordinates(41.15, -8.61)).toBeTrue();
    expect(venueHasMainlandCoordinates(0, 0)).toBeFalse();
    expect(venueHasMainlandCoordinates(32.65, -16.9)).toBeFalse();
    expect(venueHasMainlandCoordinates(38.7, -5.5)).toBeFalse();
    expect(venueHasMainlandCoordinates(null, -9.1)).toBeFalse();
  });

  it('uses the same plausible national GPS guard for island venues', () => {
    for (const [latitude, longitude] of [
      [38.7223, -9.1393], [41.8, -6.77], [37.741, -25.675],
      [39.47, -31.22], [32.648, -16.908], [33.06, -16.34]
    ]) {
      expect(venueHasPortugueseCoordinates(latitude, longitude)).toBeTrue();
      expect(venueOsmEmbedUrl(latitude, longitude))
        .withContext('map for ' + latitude + ',' + longitude).toContain('marker=');
    }
    for (const [latitude, longitude] of [
      [0, 0], [38.72, -5.5], [34, -8], [43, -8],
      [NaN, -9], [38.7, Infinity]
    ]) {
      expect(venueHasPortugueseCoordinates(latitude, longitude)).toBeFalse();
      expect(venueOsmEmbedUrl(latitude, longitude)).toBeNull();
    }
  });

  it('creates mode-specific Google Maps directions without guessing an origin', () => {
    const directions = [
      ['driving', '38.7223,-9.1393'],
      ['walking', '37.741,-25.675'],
      ['transit', '32.648,-16.908']
    ] as const;
    for (const [mode, destination] of directions) {
      const url = venueDirectionsUrl(
        Number(destination.split(',')[0]), Number(destination.split(',')[1]), mode);
      expect(url).not.toBeNull();
      const parsed = new URL(url!);
      expect(parsed.origin).toBe('https://www.google.com');
      expect(parsed.pathname).toBe('/maps/dir/');
      expect(parsed.searchParams.get('api')).toBe('1');
      expect(parsed.searchParams.get('destination')).toBe(destination);
      expect(parsed.searchParams.get('travelmode')).toBe(mode);
      expect(parsed.searchParams.has('origin')).toBeFalse();
      expect(parsed.searchParams.has('dir_action')).toBeFalse();
    }
  });

  it('does not fabricate routes for missing or implausible GPS', () => {
    for (const [lat, lon] of [[0, 0], [38.7, -5.5], [NaN, -8], [42.8, -8]]) {
      expect(venueDirectionsUrl(lat, lon, 'driving')).toBeNull();
    }
    expect(venueDirectionsUrl(null, -9.1, 'walking')).toBeNull();
    expect(venueDirectionsUrl(38.7, undefined, 'transit')).toBeNull();
    expect(venueDirectionsUrl(38.7, -9.1, 'flying' as any)).toBeNull();
  });

  it('offers safe click-to-call only for public-looking Portuguese phone numbers', () => {
    expect(venueTelephoneUrl('912 345 678')).toBe('tel:+351912345678');
    expect(venueTelephoneUrl('Telefone: 21 123 45 67')).toBe('tel:+351211234567');
    expect(venueTelephoneUrl('+351 912 345 678')).toBe('tel:+351912345678');
    expect(venueTelephoneUrl('800 123 456')).toBe('tel:+351800123456');
  });

  it('does not mistake other contact text, scripts or links for telephone numbers', () => {
    for (const input of ['info@recinto.pt', 'https://recinto.pt', 'Sem contacto',
      '912345678; 911223344', '112', 'javascript:alert(1)', '+123456789',
      '00351912345678', '912-345-678 ext 4']) {
      expect(venueTelephoneUrl(input)).toBeNull();
    }
    expect(venueTelephoneUrl(null)).toBeNull();
    expect(venueTelephoneUrl('')).toBeNull();
  });
});
