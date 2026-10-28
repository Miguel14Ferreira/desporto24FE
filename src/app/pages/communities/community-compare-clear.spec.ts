import { CommunitiesComponent } from './communities.component';
import { CommunityStanding } from '../model/community-group';

describe('Community comparison clear behavior', () => {
  it('clears both selections but stays in Statistics with the rankings data intact', () => {
    // This handler is a pure UI operation: instantiate no services, router or API.
    const view=Object.create(CommunitiesComponent.prototype) as CommunitiesComponent;
    const original: CommunityStanding = {
      position:1, profileId:null, username:null, fullName:'Ferreirinha',
      profilePicUrl:null, games:4, wins:3, draws:0, losses:1, points:9,
      goals:0, assists:0, mvps:0, cleanSheets:0,
      winRate:75, currentStreak:'W1', bestWinStreak:2
    };
    view.activeTab='stats';
    view.compareSelectionA='standing:0';
    view.compareSelectionB='standing:1';
    view.standingsByComparisonKey=new Map([['standing:0',original]]);
    view.clearPlayerComparison();
    expect(view.compareSelectionA).toBe('');
    expect(view.compareSelectionB).toBe('');
    expect(view.activeTab).toBe('stats');
    expect(view.comparePlayerA()).toBeUndefined();
    expect(view.comparePlayerB()).toBeUndefined();
    expect(view.standingsByComparisonKey.get('standing:0')).toEqual(original);
  });
});
