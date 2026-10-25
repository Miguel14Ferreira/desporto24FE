import { Venue } from '../pages/model/venue';

/**
 * Curated links to an operator's own facility page, never guessed telephone data.
 * Require BOTH the live Jynlo ID and the exact public venue identity to avoid
 * attaching the wrong website if a venue is changed or data is imported again.
 * Deliberately omit places with only approximate name matches.
 */
const PORTO_OFFICIAL_CONTACT_PAGES: Readonly<Record<number, Readonly<{
  name: string;
  url: string;
}>>> = {
  261: {
    name: 'Piscina Municipal da Constituição',
    url: 'https://www.agoraporto.pt/piscinas-municipais/piscina-municipal-da-constituicao'
  },
  2654: {
    name: 'Piscina Municipal de Cartes',
    url: 'https://www.agoraporto.pt/piscinas-municipais/piscina-municipal-de-cartes'
  }
};

function comparableName(name: unknown): string {
  return typeof name === 'string'
    ? name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase()
    : '';
}

export function venueOfficialContactPage(venue: Venue | null): string | null {
  if (!venue || !Number.isSafeInteger(venue.id) || venue.id <= 0) return null;
  // Prefer the existing approved catalogue contact when one is present.
  if (typeof venue.contact === 'string' && venue.contact.trim()) return null;
  if (comparableName(venue.city) !== 'porto' || comparableName(venue.district) !== 'porto') return null;
  const source = PORTO_OFFICIAL_CONTACT_PAGES[venue.id];
  return source && comparableName(venue.name) === comparableName(source.name) ? source.url : null;
}
