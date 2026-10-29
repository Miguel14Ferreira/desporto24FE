import { missingMinimumPlayers, suggestedMinimumPlayers } from './session-minimum-players';

describe('session minimum attendance', () => {
  it('requires six for small-sided football but does not exceed capacity', () => {
    expect(suggestedMinimumPlayers('Futsal', 10)).toBe(6);
    expect(suggestedMinimumPlayers('Futebol', 10)).toBe(6);
    expect(suggestedMinimumPlayers('Futebol', 4)).toBe(4);
    expect(suggestedMinimumPlayers('Padel', 4)).toBe(4);
    expect(suggestedMinimumPlayers('Ténis', 2)).toBe(2);
  });

  it('distinguishes a playable game from a partially filled one', () => {
    expect(missingMinimumPlayers(4,6)).toBe(2);
    expect(missingMinimumPlayers(6,6)).toBe(0);
  });
});
