import { TestBed } from '@angular/core/testing';
import { CommunityStanding } from '../model/community-group';
import { CommunityStatLeadersComponent } from './community-stat-leaders.component';

describe('CommunityStatLeadersComponent', () => {
  const row: CommunityStanding = {
  position:1, profileId:5, username:'ana', fullName:'Ana Silva',
  profilePicUrl:null, games:12, wins:8, draws:3, losses:1,
  points:27, goals:9, assists:5, mvps:2, cleanSheets:4,
  winRate:75, currentStreak:'3W', bestWinStreak:5
};
  beforeEach(async () => {
    await TestBed.configureTestingModule({imports:[CommunityStatLeadersComponent]}).compileComponents();
  });
  function render(values: Partial<CommunityStanding> | null = row) {
    const fixture=TestBed.createComponent(CommunityStatLeadersComponent);
    if(values) {
      const standing={...row,...values};
      for(const field of ['leader','goals','assists','mvps','cleanSheets'])fixture.componentRef.setInput(field,standing);
    }
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }
  it('retains the five stat cards with the same values and order', () => {
    const cards=render().querySelectorAll<HTMLElement>('.stat-card');
    expect(cards.length).toBe(5);
    expect(cards[0].querySelector('strong')?.textContent?.trim()).toBe('Ana Silva');
    expect(cards[0].querySelector('small')?.textContent).toContain('27');
    expect(cards[1].querySelector('small')?.textContent?.trim()).toBe('9');
    expect(cards[2].querySelector('small')?.textContent?.trim()).toBe('5');
    expect(cards[3].querySelector('small')?.textContent?.trim()).toBe('2');
    expect(cards[4].querySelector('small')?.textContent?.trim()).toBe('4');
  });
  it('preserves username fallback and empty-state dash when no standing is present', () => {
    expect(render({fullName:null}).querySelector('.stat-card strong')?.textContent?.trim()).toBe('ana');
    const empty=render(null);
    expect(empty.querySelectorAll('.stat-card').length).toBe(5);
    expect(empty.querySelector('.stat-card strong')?.textContent?.trim()).toBe('—');
    expect(empty.querySelector('button, input, a')).toBeNull();
  });
});
