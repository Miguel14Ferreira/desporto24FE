export interface Venue {
  id: number;
  name: string;
  city: string;
  address: string;
  sports: string | null;
  surfaceType: string | null;
  indoor: boolean;
  changingRooms: boolean;
  parking: boolean;
  lighting: boolean;
  latitude: number | null;
  longitude: number | null;
  createdByUsername: string | null;
}

export interface CreateVenueRequest {
  name: string;
  city: string;
  address: string;
  sports: string | null;
  surfaceType: string | null;
  indoor: boolean;
  changingRooms: boolean;
  parking: boolean;
  lighting: boolean;
  latitude: number | null;
  longitude: number | null;
}
