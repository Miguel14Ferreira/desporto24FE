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
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90
      || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return null;
  }
  const radius = 0.004;
  const west = Math.max(-180, longitude - radius);
  const east = Math.min(180, longitude + radius);
  const south = Math.max(-90, latitude - radius);
  const north = Math.min(90, latitude + radius);
  const bbox = [west, south, east, north].join('%2C');
  return 'https://www.openstreetmap.org/export/embed.html?bbox=' + bbox
    + '&layer=mapnik&marker=' + latitude + '%2C' + longitude;
}
