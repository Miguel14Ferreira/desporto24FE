/**
 * Catalogue scope: mainland Portugal. Finite GPS alone is not enough: stale
 * records sometimes carry placeholder (0, 0) or coordinates in another country.
 * This is a coarse guard, NOT proof that a point matches the venue address.
 * Extend the bounds if the catalogue starts covering islands or other countries.
 */
export function venueHasMainlandCoordinates(
  latitude: number | null | undefined,
  longitude: number | null | undefined
): boolean {
  return typeof latitude === 'number' && typeof longitude === 'number'
    && Number.isFinite(latitude) && Number.isFinite(longitude)
    && latitude >= 36.85 && latitude <= 42.25
    && longitude >= -9.65 && longitude <= -6.05;
}

/** Plausible facility site coordinates for mainland Portugal, the Azores
 * and Madeira. A geographical bound is not proof of a public entrance.
 */
export function venueHasPortugueseCoordinates(
  latitude: number | null | undefined,
  longitude: number | null | undefined
): boolean {
  if (typeof latitude !== 'number' || typeof longitude !== 'number'
      || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  return venueHasMainlandCoordinates(latitude, longitude)
    || (latitude >= 36.5 && latitude <= 40.2 && longitude >= -31.5 && longitude <= -24.5)
    || (latitude >= 32.5 && latitude <= 33.5 && longitude >= -17.5 && longitude <= -16.0);
}

/**
 * A public venue contact is not necessarily a phone number (it may be an
 * email address, website or description). Never dial unvalidated text.
 *
 * Supports Portuguese 9-digit fixed/mobile/toll-free contacts and +351
 * international format. Other contacts are still rendered as plain text.
 */
export function venueTelephoneUrl(contact: string | null | undefined): string | null {
  if (!contact) return null;
  let candidate = contact.trim().replace(/^(?:tel(?:efone)?|contacto|phone)\s*:\s*/i, '');
  if (!candidate || /[@\/?#;]|https?:|[a-z]/i.test(candidate)) return null;
  if (!/^\+?[0-9\s().-]+$/.test(candidate)) return null;
  const digits = candidate.replace(/\D/g, '');
  if (/^351[289]\d{8}$/.test(digits) && candidate.startsWith('+')) {
    return 'tel:+' + digits;
  }
  if (/^[289]\d{8}$/.test(digits) && !candidate.includes('+')) {
    return 'tel:+351' + digits;
  }
  return null;
}

/**
 * OSM's own share panel exposes this marker iframe format. We embed using only
 * finite coordinates from the catalogue, never a raw user-provided URL.
 * A modest bbox shows the immediate surroundings without a second API/key.
 */
export function venueOsmEmbedUrl(latitude: number, longitude: number): string | null {
  if (!venueHasPortugueseCoordinates(latitude, longitude)) {
    return null;
  }
  const radius = 0.004;
  // Avoid binary floating-point tails in OSM iframe URLs and stable tests.
  const sixDecimals = (coordinate: number): number => Number(coordinate.toFixed(6));
  const west = sixDecimals(Math.max(-180, longitude - radius));
  const east = sixDecimals(Math.min(180, longitude + radius));
  const south = sixDecimals(Math.max(-90, latitude - radius));
  const north = sixDecimals(Math.min(90, latitude + radius));
  const bbox = [west, south, east, north].join('%2C');
  return 'https://www.openstreetmap.org/export/embed.html?bbox=' + bbox
    + '&layer=mapnik&marker=' + latitude + '%2C' + longitude;
}
