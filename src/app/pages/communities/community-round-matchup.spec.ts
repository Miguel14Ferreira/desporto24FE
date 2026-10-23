import { communityRoundMatchup } from './community-round-matchup';
import { CommunityRound, CommunityRoundEntry } from '../model/community-group';

describe('Community rounds as matchups', () => {
  const player = (name: string, result: CommunityRoundEntry['result'], team: string | null = null): CommunityRoundEntry => ({
    fullName: name, username: null, profileId: null, profilePicUrl: null,
    team, result, goals: 0, assists: 0, mvp: false, cleanSheet: false
  });
  const round = (entries: CommunityRoundEntry[]): CommunityRound => ({
    id: 1, name: 'Import 2026-09-21', playedAt: '2026-09-21T00:00:00Z', entries
  });
  const group = (entries: CommunityRoundEntry[]) => communityRoundMatchup(round(entries), 'Equipa A', 'Equipa B');

  it('renders balanced imported 5 winners and 5 losers as two teams without manufacturing a score', () => {
    const entries = [
      ...['Mestre', 'Estanqueiro', 'Fábio', 'Borralho', 'André'].map(n => player(n, 'WIN')),
      ...['Graça', 'Esteves', 'Mimocas', 'Varela', 'Ferreirinha'].map(n => player(n, 'LOSS'))
    ];
    const matchup = group(entries);
    expect(matchup?.inferred).toBeTrue();
    expect(matchup?.left.label).toBe('Equipa A');
    expect(matchup?.left.entries.map(e => e.fullName)).toEqual(['Mestre', 'Estanqueiro', 'Fábio', 'Borralho', 'André']);
    expect(matchup?.right.label).toBe('Equipa B');
    expect(matchup?.right.entries).toHaveSize(5);
    expect(matchup?.left.result).toBe('WIN');
    expect(matchup?.right.result).toBe('LOSS');
  });

  it('respects actual team names even when team sizes differ', () => {
    const matchup = group([
      player('A', 'LOSS', 'Azuis'), player('B', 'LOSS', 'Azuis'),
      player('C', 'WIN', 'Brancos'), player('D', 'WIN', 'Brancos'), player('E', 'WIN', 'Brancos')
    ]);
    expect(matchup?.inferred).toBeFalse();
    expect(matchup?.left.label).toBe('Brancos');
    expect(matchup?.right.label).toBe('Azuis');
  });

  it('keeps a flat list for mixed results, solo matches and partial team labels', () => {
    expect(group([player('A', 'WIN'), player('B', 'LOSS')])).toBeNull();
    expect(group([player('A', 'WIN'), player('B', 'WIN'), player('C', 'LOSS'), player('D', 'DRAW')])).toBeNull();
    expect(group([player('A', 'WIN'), player('B', 'WIN'), player('C', 'LOSS'), player('D', 'LOSS'), player('E', 'LOSS')])).toBeNull();
    expect(group([player('A', 'WIN', 'A'), player('B', 'WIN'), player('C', 'LOSS'), player('D', 'LOSS')])).toBeNull();
  });
});
