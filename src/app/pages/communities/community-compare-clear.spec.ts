import { CommunitiesComponent } from './communities.component';
import { CommunityStanding } from '../model/community-group';

describe('Community comparison clear behavior', () => {
  const alpha: CommunityStanding = {
    position:1, profileId:null, username:null, fullName:'Ferreirinha',
    profilePicUrl:null, games:4, wins:3, draws:0, losses:1, points:9,
    goals:0, assists:0, mvps:0, cleanSheets:0,
    winRate:75, currentStreak:'W1', bestWinStreak:2
  };
  const beta: CommunityStanding = {...alpha, position:2, fullName:'Graça', points:12};

  function compareView(): CommunitiesComponent {
    // Pure UI behavior. No API, router or database access is needed.
    const view=Object.create(CommunitiesComponent.prototype) as CommunitiesComponent;
    view.activeTab='stats';
    view.compareSelectionA='standing:0';
    view.compareSelectionB='standing:1';
    view.standingsByComparisonKey=new Map([
      ['standing:0',alpha],['standing:1',beta]
    ]);
    return view;
  }

  it('clears A without changing B, rankings, or statistics tab', () => {
    const view=compareView();
    view.clearPlayerComparison('A');
    expect(view.compareSelectionA).toBe('');
    expect(view.compareSelectionB).toBe('standing:1');
    expect(view.comparePlayerA()).toBeUndefined();
    expect(view.comparePlayerB()).toBe(beta);
    expect(view.standingsByComparisonKey.get('standing:0')).toBe(alpha);
    expect(view.activeTab).toBe('stats');
  });

  it('clears B without changing A, rankings, or statistics tab', () => {
    const view=compareView();
    view.clearPlayerComparison('B');
    expect(view.compareSelectionA).toBe('standing:0');
    expect(view.compareSelectionB).toBe('');
    expect(view.comparePlayerA()).toBe(alpha);
    expect(view.comparePlayerB()).toBeUndefined();
    expect(view.standingsByComparisonKey.get('standing:1')).toBe(beta);
    expect(view.activeTab).toBe('stats');
  });

  it('can clear both independently with two explicit actions', () => {
    const view=compareView();
    view.clearPlayerComparison('B');
    view.clearPlayerComparison('A');
    expect(view.compareSelectionA).toBe('');
    expect(view.compareSelectionB).toBe('');
    expect(view.activeTab).toBe('stats');
    expect(view.standingsByComparisonKey.size).toBe(2);
  });
});
