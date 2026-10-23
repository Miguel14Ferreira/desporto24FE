/** Athletics subdiscipline is descriptive metadata; not federation scoring rules. */
export type AthleticsDiscipline = 'LONG_JUMP' | 'TRIPLE_JUMP' | 'HIGH_JUMP' | 'POLE_VAULT'
  | 'SHOT_PUT' | 'DISCUS' | 'JAVELIN' | 'HAMMER';

export type GymApparatus = 'FLOOR' | 'VAULT' | 'POMMEL_HORSE' | 'RINGS'
  | 'PARALLEL_BARS' | 'HORIZONTAL_BAR' | 'UNEVEN_BARS' | 'BALANCE_BEAM';
const GYM_APPARATUS: readonly GymApparatus[] = [
  'FLOOR', 'VAULT', 'POMMEL_HORSE', 'RINGS',
  'PARALLEL_BARS', 'HORIZONTAL_BAR', 'UNEVEN_BARS', 'BALANCE_BEAM'
];
const OPTIONS: Record<string, readonly AthleticsDiscipline[]> = {
  JUMP: ['LONG_JUMP', 'TRIPLE_JUMP', 'HIGH_JUMP', 'POLE_VAULT'],
  THROW: ['SHOT_PUT', 'DISCUS', 'JAVELIN', 'HAMMER']
};

export function athleticsDisciplineOptions(
  sport: string | null | undefined, eventType: string | null | undefined
): readonly (AthleticsDiscipline | GymApparatus)[] {
  const normalized = sport?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  if (normalized === 'atletismo') return OPTIONS[eventType || ''] ?? [];
  if (normalized === 'ginastica artistica' && eventType === 'APPARATUS') return GYM_APPARATUS;
  return [];
}

export function athleticsDisciplineValid(
  sport: string | null | undefined, eventType: string | null | undefined,
  discipline: string | null | undefined
): boolean {
  const options = athleticsDisciplineOptions(sport, eventType);
  return options.length
    ? options.includes(discipline as AthleticsDiscipline | GymApparatus)
    : !discipline;
}
