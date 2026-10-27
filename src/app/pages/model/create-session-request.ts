export interface CreateSessionRequest {
  sport: string;
  /** Optional for legacy API clients; server infers safe default. */
  playFormat?: 'INDIVIDUAL' | 'PAIRS' | 'TEAMS';
  gameDate: string;
  city: string;
  address: string;
  maxParticipants: number;
  externalConfirmedParticipants?: number;
  priceAmount: number;
  privateGame: boolean;
  password: string | null;
  latitude: number | null;
  longitude: number | null;
  communityId?: number | null;
  communityShareIds?: number[];
  venueId?: number | null;
  recurrence?: 'NONE' | 'WEEKLY' | 'BIWEEKLY';
  recurrenceOccurrences?: number | null;
  additionalWeeklyGameDates?: string[];
  recurrenceTimeZone?: string | null;
  registrationOpeningMode?: 'IMMEDIATE' | 'SCHEDULED' | 'MANUAL';
  registrationOpensAt?: string | null;
}
