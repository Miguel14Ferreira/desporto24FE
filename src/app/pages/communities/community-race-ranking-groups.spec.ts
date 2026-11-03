import { raceRankingGroupsForCommunity } from './community-race-ranking-groups';
import { CommunityRaceStandingGroup } from '../model/community-group';

describe('Race-specific community rankings', () => {
  it('shows Karting standings before the first race without football match columns', () => {
    expect(raceRankingGroupsForCommunity(['Karting'], []))
      .toEqual([{sport:'Karting',rule:null,standings:[]}]);
  });

  it('preserves recorded positions and configured race points in mixed communities', () => {
    const live: CommunityRaceStandingGroup = {
      sport:'Karting',rule:{sport:'Karting',pointsByPlace:[25,18]},
      standings:[{position:1,playerId:5,profileId:5,username:'ana',fullName:'Ana',
        profilePicUrl:null,races:2,wins:1,podiums:2,bestFinish:1,
        championshipPoints:43,penaltyPoints:0}]
    };
    const recorded = [live];
    const result = raceRankingGroupsForCommunity(['Karting','Futebol'], recorded);
    expect(result).toEqual([live]);
    expect(result[0]).toBe(live);
    expect(recorded.length).toBe(1);
  });

  it('does not borrow generic race standings for rowing, canoe, swimming or football', () => {
    expect(raceRankingGroupsForCommunity(
      ['Remo','Canoagem Velocidade','Natação','Futebol'], []
    )).toEqual([]);
    expect(raceRankingGroupsForCommunity(['Karting','Karting','Automobilismo'], [])
      .map(group => group.sport)).toEqual(['Karting','Automobilismo']);
  });
});
