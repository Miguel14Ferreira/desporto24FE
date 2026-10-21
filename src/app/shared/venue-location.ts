import { Venue, VenueLocationStatus } from '../pages/model/venue';

/** Informative location status, not proof of facility operation or public access. */
export function venueLocationStatus(venue: Venue): VenueLocationStatus {
  if (venue.locationStatus === 'GPS_ONLY_ADDRESS_UNKNOWN'
      || venue.locationStatus === 'ADDRESS_PROVIDED_UNVERIFIED'
      || venue.locationStatus === 'LOCATION_UNKNOWN') {
    return venue.locationStatus;
  }

  // Old API responses may have no locationStatus; avoid displaying OSM
  // coordinate placeholders as postal addresses during staggered deployments.
  const address = typeof venue.address === 'string' ? venue.address.trim() : '';
  const lowered = address.toLocaleLowerCase('pt-PT');
  const placeholder = !address
      || lowered.startsWith('localização no mapa:')
      || lowered.startsWith('localizacao no mapa:')
      || lowered.startsWith('coordenadas (morada por confirmar)')
      || lowered.includes('morada por confirmar')
      || lowered.includes('address to be confirmed')
      || lowered.startsWith('map location:');

  if (!placeholder) return 'ADDRESS_PROVIDED_UNVERIFIED';
  const lat = venue.latitude;
  const lon = venue.longitude;
  return lat !== null && lat !== undefined && Number.isFinite(lat) && Math.abs(lat) <= 90
      && lon !== null && lon !== undefined && Number.isFinite(lon) && Math.abs(lon) <= 180
    ? 'GPS_ONLY_ADDRESS_UNKNOWN'
    : 'LOCATION_UNKNOWN';
}

export function isVenueGpsOnly(venue: Venue): boolean {
  return venueLocationStatus(venue) === 'GPS_ONLY_ADDRESS_UNKNOWN';
}

export function venuePostalAddress(venue: Venue): string | null {
  if (venueLocationStatus(venue) !== 'ADDRESS_PROVIDED_UNVERIFIED') return null;
  const address = typeof venue.address === 'string' ? venue.address.trim() : '';
  return address || null;
}
