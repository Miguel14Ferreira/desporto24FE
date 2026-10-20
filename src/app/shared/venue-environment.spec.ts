import { Venue } from '../pages/model/venue';
import { venueEnvironmentTranslationKey } from './venue-environment';

describe('venueEnvironmentTranslationKey', () => {
  const classification = (environmentType: Venue['environmentType'], indoor: boolean) =>
    venueEnvironmentTranslationKey({ environmentType, indoor });

  it('uses the explicit environment rather than the legacy indoor flag', () => {
    expect(classification('INDOOR', false)).toBe('venue.environment.indoor');
    expect(classification('OUTDOOR', true)).toBe('venue.environment.outdoor');
    expect(classification('BOTH', false)).toBe('venue.environment.both');
    expect(classification('BOTH', true)).toBe('venue.environment.both');
  });

  it('does not mislabel an unknown environment as outdoor', () => {
    expect(classification(null, false)).toBe('venue.boolean.none');
    expect(classification(null, true)).toBe('venue.environment.indoor');
  });
});
