import { TestBed } from '@angular/core/testing';
import { CommunityStanding } from '../model/community-group';
import { CommunityPerformanceInsightsComponent } from './community-performance-insights.component';

describe('CommunityPerformanceInsightsComponent', () => {
  const alpha: CommunityStanding = {
    position: 1, profileId: 1, username: 'alpha', fullName: 'Jogadora Alfa',
    profilePicUrl: null, games: 9, wins: 7, draws: 1, losses: 1,
    points: 50, goals: 18, assists: 4, mvps: 2, cleanSheets: 5,
    winRate: 78, currentStreak: 'W3', bestWinStreak: 5
  };
  const beta: CommunityStanding = {
    ...alpha, position: 2, profileId: 2, username: 'beta', fullName: 'Jogador Beta',
    games: 7, points: 25, goals: 8, assists: 2, wins: 4, winRate: 57
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CommunityPerformanceInsightsComponent]
    }).compileComponents();
  });

  function render() {
    const fixture = TestBed.createComponent(CommunityPerformanceInsightsComponent);
    fixture.componentRef.setInput('rows', [alpha, beta]);
    fixture.componentRef.setInput('mostGames', alpha);
    fixture.componentRef.setInput('bestWinRate', alpha);
    fixture.componentRef.setInput('bestWinStreak', alpha);
    fixture.componentRef.setInput('maxStandingPoints', 50);
    fixture.componentRef.setInput('compareSelectionA', 'standing:0');
    fixture.componentRef.setInput('compareSelectionB', 'standing:1');
    fixture.componentRef.setInput('comparePlayerA', alpha);
    fixture.componentRef.setInput('comparePlayerB', beta);
    fixture.detectChanges();
    return fixture;
  }

  it('preserves records, top ten chart order and ratio-sized point bars', () => {
    const root = render().nativeElement as HTMLElement;
    expect(root.querySelectorAll('.record-card').length).toBe(3);
    expect(root.querySelector('.record-card')?.textContent).toContain('Jogadora Alfa');
    const rows = root.querySelectorAll('.points-chart-row');
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('Jogadora Alfa');
    expect(rows[1].textContent).toContain('Jogador Beta');
    expect(root.querySelectorAll<HTMLElement>('.points-chart-track > span')[0].style.width).toBe('100%');
    expect(root.querySelectorAll<HTMLElement>('.points-chart-track > span')[1].style.width).toBe('50%');
    expect(root.querySelectorAll('.compare-table > div').length).toBe(8);
    expect(root.querySelector('.compare-table')?.textContent).toContain('57%');
  });

  it('keeps player selector choices wired to parent-managed names', () => {
    const fixture = render();
    const root = fixture.nativeElement as HTMLElement;
    const opts = root.querySelectorAll('.compare-selectors select');
    expect(opts.length).toBe(2);
    const a = jasmine.createSpy('A');
    const b = jasmine.createSpy('B');
    fixture.componentInstance.compareAChange.subscribe(a);
    fixture.componentInstance.compareBChange.subscribe(b);
    const selectA = opts[0] as HTMLSelectElement;
    const selectB = opts[1] as HTMLSelectElement;
    selectA.value = 'standing:1';
    selectA.dispatchEvent(new Event('change', {bubbles: true}));
    selectB.value = 'standing:0';
    selectB.dispatchEvent(new Event('change', {bubbles: true}));
    fixture.detectChanges();
    expect(a).toHaveBeenCalledWith('standing:1');
    expect(b).toHaveBeenCalledWith('standing:0');
    expect(fixture.componentInstance.compareSelectionA).toBe('standing:0');
  });

  it('offers historical players without accounts in both selectors and compares their real numbers', () => {
    const fixture = render();
    const historic = {
      ...alpha, username: null, profileId: null, fullName: 'Ferreirinha', points: 16
    };
    const other = {
      ...beta, username: null, profileId: null, fullName: 'Mestre', points: 22
    };
    fixture.componentRef.setInput('rows', [historic, other]);
    fixture.componentRef.setInput('compareSelectionA', 'standing:0');
    fixture.componentRef.setInput('compareSelectionB', 'standing:1');
    fixture.componentRef.setInput('comparePlayerA', historic);
    fixture.componentRef.setInput('comparePlayerB', other);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const options = Array.from(root.querySelectorAll('.compare-selectors select')).map(select =>
      Array.from((select as HTMLSelectElement).options).map(option => [option.value, option.textContent?.trim()])
    );
    expect(options[0].slice(1)).toEqual([['standing:0', 'Ferreirinha'], ['standing:1', 'Mestre']]);
    expect(options[1].slice(1)).toEqual([['standing:0', 'Ferreirinha'], ['standing:1', 'Mestre']]);
    expect(root.querySelector('.compare-table')?.textContent).toContain('Ferreirinha');
    expect(root.querySelector('.compare-table')?.textContent).toContain('Mestre');
    expect(root.querySelector('.compare-table')?.textContent).toContain('16');
    expect(root.querySelector('.compare-table')?.textContent).toContain('22');
  });

  it('hides the head-to-head matrix without both selected players and keeps the empty chart', () => {
    const fixture = render();
    fixture.componentRef.setInput('comparePlayerB', undefined);
    fixture.componentRef.setInput('rows', []);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.compare-table')).toBeNull();
    expect(root.querySelectorAll('.points-chart-row').length).toBe(0);
    expect(root.querySelectorAll('.record-card').length).toBe(3);
    expect(fixture.componentInstance.pointsBarWidth({ ...alpha, points: 0 })).toBe(4);
    fixture.componentRef.setInput('maxStandingPoints', 0);
    fixture.detectChanges();
    expect(fixture.componentInstance.pointsBarWidth(alpha)).toBe(0);
  });
});
