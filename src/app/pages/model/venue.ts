export type VenueOwnershipType = 'PUBLIC' | 'PRIVATE';
export type VenueInformationSource = 'COMMUNITY' | 'OFFICIAL';
export type VenueEnvironmentType = 'INDOOR' | 'OUTDOOR' | 'BOTH';

export interface Venue {
  id: number;
  name: string;
  city: string;
  address: string;
  sports: string | null;
  venueType: string | null;
  ownershipType: VenueOwnershipType | null;
  surfaceType: string | null;
  environmentType: VenueEnvironmentType;
  indoor: boolean;
  changingRooms: boolean;
  toilets: boolean | null;
  lockers: boolean | null;
  showers: boolean | null;
  stands: boolean | null;
  accessible: boolean | null;
  firstAid: boolean | null;
  aed: boolean | null;
  cafe: boolean | null;
  services: string | null;
  transport: string | null;
  openingHours: string | null;
  priceInfo: string | null;
  website: string | null;
  contact: string | null;
  parking: boolean;
  lighting: boolean;
  latitude: number | null;
  longitude: number | null;
  informationSource: VenueInformationSource;
  createdByUsername: string | null;
  createdAt: string;
}

export interface CreateVenueRequest {
  name: string;
  city: string;
  address: string;
  sports: string | null;
  venueType?: string | null;
  ownershipType?: VenueOwnershipType | null;
  surfaceType: string | null;
  environmentType?: VenueEnvironmentType | null;
  indoor: boolean;
  changingRooms: boolean;
  toilets?: boolean | null;
  lockers?: boolean | null;
  showers?: boolean | null;
  stands?: boolean | null;
  accessible?: boolean | null;
  firstAid?: boolean | null;
  aed?: boolean | null;
  cafe?: boolean | null;
  services?: string | null;
  transport?: string | null;
  openingHours?: string | null;
  priceInfo?: string | null;
  website?: string | null;
  contact?: string | null;
  parking: boolean;
  lighting: boolean;
  latitude: number | null;
  longitude: number | null;
}
