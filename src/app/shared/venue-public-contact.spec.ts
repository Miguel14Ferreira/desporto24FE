import { venueOsmEmbedUrl, venueTelephoneUrl } from './venue-public-contact';

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
