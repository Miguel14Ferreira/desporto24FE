export interface CreateSessionRequest {
  sport: string;
  gameDate: string;
  city: string;
  address: string;
  maxParticipants: number;
  priceAmount: number;
  privateGame: boolean;
  password: string | null;
  latitude: number | null;
  longitude: number | null;
  communityId?: number | null;
  venueId?: number | null;
}
