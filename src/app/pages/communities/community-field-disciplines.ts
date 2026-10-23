/** Athletics subdiscipline is descriptive metadata; not federation scoring rules. */
export type AthleticsDiscipline = 'LONG_JUMP' | 'TRIPLE_JUMP' | 'HIGH_JUMP' | 'POLE_VAULT'
  | 'SHOT_PUT' | 'DISCUS' | 'JAVELIN' | 'HAMMER';

const OPTIONS: Record<string, readonly AthleticsDiscipline[]> = {
  JUMP: ['LONG_JUMP', 'TRIPLE_JUMP', 'HIGH_JUMP', 'POLE_VAULT'],
  THROW: ['SHOT_PUT', 'DISCUS', 'JAVELIN', 'HAMMER']
};

export function athleticsDisciplineOptions(
  sport: string | null | undefined, eventType: string | null | undefined
): readonly AthleticsDiscipline[] {
  return sport?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase() === 'atletismo'
    ? OPTIONS[eventType || ''] ?? [] : [];
}

export function athleticsDisciplineValid(
  sport: string | null | undefined, eventType: string | null | undefined,
  discipline: string | null | undefined
): boolean {
  const options = athleticsDisciplineOptions(sport, eventType);
  return options.length
    ? options.includes(discipline as AthleticsDiscipline)
    : !discipline;
}
