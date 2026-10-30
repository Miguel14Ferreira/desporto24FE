import { TestBed } from '@angular/core/testing';
import { CommunityStanding } from '../model/community-group';
import { CommunityLeaderHighlightComponent } from './community-leader-highlight.component';

describe('CommunityLeaderHighlightComponent', () => {
  const leader: CommunityStanding = {
    position: 1, profileId: 21, username: 'ana', fullName: 'Ana Silva',
    profilePicUrl: null, games: 5, wins: 5, draws: 0, losses: 0,
    points: 15, goals: 3, assists: 0, mvps: 2, cleanSheets: 0,
    winRate: 100, currentStreak: '5W', bestWinStreak: 5
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [CommunityLeaderHighlightComponent] }).compileComponents();
  });

  function render(standing: CommunityStanding = leader) {
    const fixture = TestBed.createComponent(CommunityLeaderHighlightComponent);
    fixture.componentRef.setInput('standing', standing);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('retains name, username and points in the current leader highlight', () => {
    const root = render();
    expect(root.querySelector('h3')?.textContent?.trim()).toBe('Ana Silva');
    expect(root.querySelector('p')?.textContent).toContain('@ana');
    expect(root.querySelector('.leader-score')?.textContent?.trim()).toBe('15');
    expect(root.querySelector('button, a, input')).toBeNull();
  });

  it('falls back to username when the leader has no full name', () => {
    expect(render({...leader, fullName: null}).querySelector('h3')?.textContent?.trim()).toBe('ana');
  });
});
