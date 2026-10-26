import { TestBed } from '@angular/core/testing';
import { CommunitySeason } from '../model/community-group';
import { CommunitySeasonTrophiesComponent } from './community-season-trophies.component';

describe('CommunitySeasonTrophiesComponent', () => {
  const season: CommunitySeason = {
    id: 44, name: '2026', startsAt: '2026-01-01', endedAt: '2026-09-01',
    active: false, championUsername: 'ana', championDisplayName: 'Ana Silva', championPoints: 42
  };
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [CommunitySeasonTrophiesComponent] }).compileComponents();
  });
  function render(seasons: CommunitySeason[]) {
    const fixture = TestBed.createComponent(CommunitySeasonTrophiesComponent);
    fixture.componentRef.setInput('seasons', seasons);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }
  it('keeps trophy history, champion, score and presentation-only behavior', () => {
    const root = render([season, { ...season, id: 45, name: '2025', championDisplayName: null }]);
    const cards = root.querySelectorAll('.trophy-card');
    expect(cards.length).toBe(2);
    expect(cards[0].textContent).toContain('2026');
    expect(cards[0].textContent).toContain('Ana Silva');
    expect(cards[0].textContent).toContain('42');
    expect(cards[1].textContent).toContain('ana');
    expect(root.querySelector('button, input, a')).toBeNull();
  });
  it('retains empty historical trophies text when there are no official champions', () => {
    const root = render([]);
    expect(root.querySelector('.trophies-grid')).toBeNull();
    expect(root.querySelector('.module-empty.compact')).not.toBeNull();
    expect(root.querySelector('h3')).not.toBeNull();
    expect(root.querySelector('p')).not.toBeNull();
  });
});
