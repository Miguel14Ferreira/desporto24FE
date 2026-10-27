import { CommunityStanding } from '../model/community-group';
import {
  communityComparisonKey,
  communityComparisonLookup,
  communityComparisonRows
} from './community-player-comparison';

describe('Community player comparison identities', () => {
  const historic: CommunityStanding = {
    position: 1, profileId: null, username: null, fullName: 'Ferreirinha',
    profilePicUrl: null, games: 8, wins: 5, draws: 1, losses: 2,
    points: 16, goals: 3, assists: 1, mvps: 0, cleanSheets: 2,
    winRate: 62.5, currentStreak: 'W2', bestWinStreak: 3
  };
  const another = { ...historic, position: 2, fullName: 'Mestre', points: 21 };
  const linked = { ...historic, position: 3, profileId: 12, username: 'joao',
    fullName: 'João', points: 24 };

  it('includes all players with recorded results, linked or historical', () => {
    const rows = communityComparisonRows([historic, another, linked]);
    const lookup = communityComparisonLookup(rows);
    expect(rows.length).toBe(3);
    expect([...lookup.keys()]).toEqual([
      communityComparisonKey(0), communityComparisonKey(1), communityComparisonKey(2)
    ]);
    expect(lookup.get(communityComparisonKey(0))).toBe(historic);
    expect(lookup.get(communityComparisonKey(1))).toBe(another);
    expect(lookup.get(communityComparisonKey(2))).toBe(linked);
  });

  it('keeps equal historical names distinct, without creating usernames', () => {
    const duplicate = { ...another, fullName: 'Ferreirinha', position: 4, points: 39 };
    const lookup = communityComparisonLookup([historic, duplicate]);
    expect(lookup.size).toBe(2);
    expect(lookup.get(communityComparisonKey(0))?.points).toBe(16);
    expect(lookup.get(communityComparisonKey(1))?.points).toBe(39);
    expect(lookup.get(communityComparisonKey(0))?.username).toBeNull();
  });

  it('uses only rows already visible in the statistics tab', () => {
    const idle = { ...historic, fullName: 'Sem jogos', games: 0 };
    const lookup = communityComparisonLookup([idle, historic, another]);
    expect(lookup.size).toBe(2);
    expect(lookup.get(communityComparisonKey(0))).toBe(historic);
    expect(lookup.get(communityComparisonKey(1))).toBe(another);
  });
});
