import { Venue } from '../pages/model/venue';

/**
 * Only classify a venue as outdoor when that fact is explicit.
 * The legacy indoor=false field is also the default for records with unknown
 * conditions, including official catalogue imports without environment data.
 */
export function venueEnvironmentTranslationKey(
  venue: Pick<Venue, 'environmentType' | 'indoor'>
): string {
  switch (venue.environmentType) {
    case 'INDOOR':
      return 'venue.environment.indoor';
    case 'OUTDOOR':
      return 'venue.environment.outdoor';
    case 'BOTH':
      return 'venue.environment.both';
    default:
      return venue.indoor === true ? 'venue.environment.indoor' : 'venue.boolean.none';
  }
}
