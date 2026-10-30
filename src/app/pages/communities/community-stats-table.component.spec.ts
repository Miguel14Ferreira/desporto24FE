import { TestBed } from '@angular/core/testing';
import { CommunityStanding } from '../model/community-group';
import { CommunityStatsTableComponent } from './community-stats-table.component';

describe('CommunityStatsTableComponent', () => {
  const row: CommunityStanding = {
  position:1, profileId:5, username:'ana', fullName:'Ana Silva',
  profilePicUrl:null, games:12, wins:8, draws:3, losses:1,
  points:27, goals:9, assists:5, mvps:2, cleanSheets:4,
  winRate:75, currentStreak:'3W', bestWinStreak:5
};
  beforeEach(async () => {
    await TestBed.configureTestingModule({imports:[CommunityStatsTableComponent]}).compileComponents();
  });
  function render(rows: CommunityStanding[]) {
    const fixture=TestBed.createComponent(CommunityStatsTableComponent);
    fixture.componentRef.setInput('rows',rows);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }
  it('preserves all nine columns and their values in the same order', () => {
    const root=render([row]);
    const cells=root.querySelectorAll<HTMLTableCellElement>('tbody tr td');
    expect(root.querySelectorAll('thead th').length).toBe(9);
    expect(cells.length).toBe(9);
    expect(cells[0].textContent).toContain('Ana Silva');
    expect(cells[1].textContent?.trim()).toBe('12');
    expect(cells[2].textContent?.trim()).toBe('9');
    expect(cells[6].textContent?.trim()).toBe('75%');
    expect(cells[8].textContent?.trim()).toBe('5');
    expect(root.querySelector('button, input, a')).toBeNull();
  });
  it('shows unlinked player copy for absent usernames and leaves row ordering unchanged', () => {
    const root=render([{...row, username:null, fullName:'Historic Player', position:2},row]);
    const rows=root.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('Historic Player');
    expect(rows[1].textContent).toContain('Ana Silva');
    expect(rows[0].querySelector('.ranking-player span')).not.toBeNull();
  });
  it('preserves the empty table without manufacturing result rows', () => {
    const root=render([]);
    expect(root.querySelectorAll('thead th').length).toBe(9);
    expect(root.querySelectorAll('tbody tr').length).toBe(0);
  });
});
