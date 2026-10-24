import { TournamentRaceEntry } from '../model/community-tournament';
import { formatKartingDuration, kartingRaceAward, orderedKartingRaceEntries } from './community-karting-race-display';

describe('Karting championship race presentation', () => {
  const entry = (name: string, place: number | null, options: Partial<TournamentRaceEntry> = {}): TournamentRaceEntry =>
    ({
      communityPlayerId: name.charCodeAt(0),
      fullName: name,
      finishPosition: place,
      elapsedSeconds: 125.25,
      bestLapSeconds: 59.125,
      racePenaltyPoints: 0,
      raceDisqualified: false,
      ...options
    });

  it('sorts classified finishers ahead of DNF and DSQ without mutating the official order', () => {
    const input = [
      entry('Ana', null),
      entry('Rui', 3),
      entry('João', 2, { raceDisqualified: true }),
      entry('Eva', 1),
      entry('Bia', 2)
    ];
    const sorted = orderedKartingRaceEntries(input);
    expect(sorted.map(driver => driver.fullName)).toEqual(['Eva', 'Bia', 'Rui', 'Ana', 'João']);
    expect(input.map(driver => driver.fullName)).toEqual(['Ana', 'Rui', 'João', 'Eva', 'Bia']);
  });

  it('preserves original order between equal valid finishing positions', () => {
    const sorted = orderedKartingRaceEntries([
      entry('Eva', 2), entry('Ana', 2), entry('Bia', 1)
    ]);
    expect(sorted.map(driver => driver.fullName)).toEqual(['Bia', 'Eva', 'Ana']);
  });

  it('formats durations in minute/second/millisecond clock notation without guessing invalid times', () => {
    expect(formatKartingDuration(59.125)).toBe('00:59.125');
    expect(formatKartingDuration(120.5)).toBe('02:00.500');
    expect(formatKartingDuration(3601.25)).toBe('1:00:01.250');
    expect(formatKartingDuration(59.9996)).toBe('01:00.000');
    expect(formatKartingDuration(0)).toBe('00:00.000');
    expect(formatKartingDuration(null)).toBe('—');
    expect(formatKartingDuration(NaN)).toBe('—');
    expect(formatKartingDuration(-1)).toBe('—');
  });

  it('computes championship points like the backend, subtracting penalty points only', () => {
    const points = [25, 18, 15];
    expect(kartingRaceAward(entry('Ana', 1), points)).toBe(25);
    expect(kartingRaceAward(entry('Rui', 2, { racePenaltyPoints: 3 }), points)).toBe(15);
    expect(kartingRaceAward(entry('Eva', 1, { racePenaltyPoints: 35 }), points)).toBe(0);
    expect(kartingRaceAward(entry('Bia', 4), points)).toBe(0);
    expect(kartingRaceAward(entry('João', null), points)).toBe(0);
    expect(kartingRaceAward(entry('Nuno', 1, { raceDisqualified: true }), points)).toBe(0);
    expect(kartingRaceAward(entry('Ana', 1, { raceTimePenaltySeconds: 5 }), points)).toBe(25);
  });
});
