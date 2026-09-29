export type VenueOwnershipType = 'PUBLIC' | 'PRIVATE';
export type VenueInformationSource = 'COMMUNITY' | 'OFFICIAL';

export interface Venue {
  id: number;
  name: string;
  city: string;
  address: string;
  sports: string | null;
  venueType: string | null;
  ownershipType: VenueOwnershipType | null;
  surfaceType: string | null;
  indoor: boolean;
  changingRooms: boolean;
  toilets: boolean | null;
  lockers: boolean | null;
  accessible: boolean | null;
  firstAid: boolean | null;
  aed: boolean | null;
  cafe: boolean | null;
  services: string | null;
  transport: string | null;
  openingHours: string | null;
  priceInfo: string | null;
  parking: boolean;
  lighting: boolean;
  latitude: number | null;
  longitude: number | null;
  informationSource: VenueInformationSource;
  createdByUsername: string | null;
}

export interface CreateVenueRequest {
  name: string;
  city: string;
  address: string;
  sports: string | null;
  venueType?: string | null;
  ownershipType?: VenueOwnershipType | null;
  surfaceType: string | null;
  indoor: boolean;
  changingRooms: boolean;
  toilets?: boolean | null;
  lockers?: boolean | null;
  accessible?: boolean | null;
  firstAid?: boolean | null;
  aed?: boolean | null;
  cafe?: boolean | null;
  services?: string | null;
  transport?: string | null;
  openingHours?: string | null;
  priceInfo?: string | null;
  parking: boolean;
  lighting: boolean;
  latitude: number | null;
  longitude: number | null;
}
