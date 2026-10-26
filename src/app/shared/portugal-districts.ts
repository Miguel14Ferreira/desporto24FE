/** Canonical district names shared with the national-venue backend. */
export const MAINLAND_PORTUGAL_DISTRICTS = [
  'Aveiro', 'Beja', 'Braga', 'Bragança', 'Castelo Branco', 'Coimbra',
  'Évora', 'Faro', 'Guarda', 'Leiria', 'Lisboa', 'Portalegre',
  'Porto', 'Santarém', 'Setúbal', 'Viana do Castelo', 'Vila Real', 'Viseu'
] as const;

/** Archipelagos are searchable regions, not 19th/20th mainland districts. */
export const PORTUGAL_AUTONOMOUS_REGIONS = ['Açores', 'Madeira'] as const;

/** Venue catalogue filter: 18 mainland districts and 2 autonomous regions. */
export const PORTUGAL_VENUE_REGIONS = [
  ...MAINLAND_PORTUGAL_DISTRICTS,
  ...PORTUGAL_AUTONOMOUS_REGIONS
] as const;

export const SEARCH_ALL_DISTRICTS = 'ALL';
