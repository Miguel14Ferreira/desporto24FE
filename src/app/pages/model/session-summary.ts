export interface SessionSummary {
  id: number;
  sport: string;
  city: string;
  gameDate: string;
  distanceKm: number | null;
  participantCount: number;
  maxParticipants: number;
  priceAmount: number;
  privateGame: boolean;
  status: string;
}
