import { raceSupportsLaps, formatRaceSeconds, raceEntryValidationError, roadTimeTrialEntryInvalid } from './community-race-metrics';

describe('Race results with recorded measures', () => {
  const racer = (finishPosition: number | null, elapsedSeconds: number | null) => ({
    finishPosition, elapsedSeconds, bestLapSeconds: null, lapsCompleted: null
  });

  it('renders true measured times and never invents missing records', () => {
    expect(formatRaceSeconds(92.43)).toBe('1:32.430');
    expect(formatRaceSeconds(5.4)).toBe('0:05.400');
    expect(formatRaceSeconds(null)).toBeNull();
    expect(formatRaceSeconds(0)).toBeNull();
    expect(formatRaceSeconds(Number.NaN)).toBeNull();
  });

  it('supports laps where the sport has lap-based results', () => {
    expect(raceSupportsLaps('Karting')).toBeTrue();
    expect(raceSupportsLaps('Motociclismo')).toBeTrue();
    expect(raceSupportsLaps('Natação')).toBeFalse();
    expect(raceSupportsLaps('Futebol')).toBeFalse();
  });

  it('validates optional measured values and distinct places before saving', () => {
    expect(raceEntryValidationError([racer(1, 92.430), racer(2, 92.621)])).toBeNull();
    expect(raceEntryValidationError([racer(null, null)])).toBeNull();
    expect(raceEntryValidationError([racer(1, null), racer(1, null)])).toBe('raceInvalidMetrics');
    expect(raceEntryValidationError([racer(-1, null)])).toBe('raceInvalidMetrics');
    expect(raceEntryValidationError([racer(1.5, null)])).toBe('raceInvalidMetrics');
    expect(raceEntryValidationError([racer(1, -2)])).toBe('raceInvalidMetrics');
    expect(raceEntryValidationError([racer(1, 92.4301)])).toBe('raceInvalidMetrics');
  });

  it('requires a classified road time-trial rider to have both place and elapsed time', () => {
    expect(roadTimeTrialEntryInvalid([racer(1, 92.430), racer(2, 95.220),
      racer(null, null)])).toBeFalse();
    expect(roadTimeTrialEntryInvalid([racer(1, null)])).toBeTrue();
    expect(roadTimeTrialEntryInvalid([racer(null, 95.220)])).toBeTrue();
    expect(roadTimeTrialEntryInvalid([{ ...racer(1, 92.430), lapsCompleted: 4 }])).toBeTrue();
    expect(roadTimeTrialEntryInvalid([{ ...racer(1, 92.430), bestLapSeconds: 30 }])).toBeTrue();
    expect(raceSupportsLaps('Ciclismo de Estrada')).toBeFalse();
  });

  it('rejects non-integral/negative laps', () => {
    expect(raceEntryValidationError([{...racer(1, 92.43), lapsCompleted: -1 }]))
      .toBe('raceInvalidMetrics');
    expect(raceEntryValidationError([{...racer(1, 92.43), lapsCompleted: 3.5 }]))
      .toBe('raceInvalidMetrics');
  });
});
