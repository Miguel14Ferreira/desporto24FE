import { TestBed } from '@angular/core/testing';
import { CommunityStanding } from '../model/community-group';
import { CommunityRankingTableComponent } from './community-ranking-table.component';
import { ProfileQuickViewService } from '../../services/profile-quick-view.service';

describe('CommunityRankingTableComponent', () => {
  const item: CommunityStanding = {
    position: 1, profileId: 4, username: 'ana', fullName: 'Ana Silva',
    profilePicUrl: null, games: 10, wins: 8, draws: 1, losses: 1, points: 25,
    goals: 7, assists: 3, mvps: 2, cleanSheets: 4, winRate: 80,
    currentStreak: 'W3', bestWinStreak: 4
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({imports: [CommunityRankingTableComponent]}).compileComponents();
  });

  function render(rows: CommunityStanding[]) {
    const fixture = TestBed.createComponent(CommunityRankingTableComponent);
    fixture.componentRef.setInput('rows', rows);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('preserves seven classification columns, player identity and numeric results', () => {
    const root = render([item]);
    const cells = root.querySelectorAll<HTMLTableCellElement>('tbody tr td');
    expect(root.querySelectorAll('thead th').length).toBe(7);
    expect(cells.length).toBe(7);
    expect(cells[0].textContent?.trim()).toBe('1');
    expect(cells[1].textContent).toContain('Ana Silva');
    expect(cells[1].textContent).toContain('@ana');
    expect(cells[2].textContent?.trim()).toBe('10');
    expect(cells[3].textContent?.trim()).toBe('8');
    expect(cells[4].textContent?.trim()).toBe('1');
    expect(cells[5].textContent?.trim()).toBe('1');
    expect(cells[6].textContent?.trim()).toBe('25');
    expect(root.querySelectorAll('tbody button.ranking-player--interactive').length).toBe(1);
    expect(root.querySelector('tbody input, tbody a')).toBeNull();
  });

  it('opens the linked player profile through the existing quick-view service', () => {
    const quick = TestBed.inject(ProfileQuickViewService);
    const open = spyOn(quick, 'open');
    const root = render([item]);
    const button = root.querySelector<HTMLButtonElement>('tbody button.ranking-player');
    expect(button).toBeTruthy();
    button!.click();
    expect(open).toHaveBeenCalledOnceWith('ana');
  });

  it('emits unlinked historical player data to open read-only stats without a user account', () => {
    const fixture = TestBed.createComponent(CommunityRankingTableComponent);
    const historic = {...item, username: null, profileId: null, fullName: 'Ferreirinha'};
    const selected = jasmine.createSpy('historicalSelected');
    fixture.componentRef.setInput('rows', [historic]);
    fixture.componentInstance.historicalSelected.subscribe(selected);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('tbody button.ranking-player') as HTMLButtonElement;
    expect(button).toBeTruthy();
    button.click();
    expect(selected).toHaveBeenCalledOnceWith(historic);
  });

  it('renders the top three podium and never changes the supplied ordering', () => {
    const root = render([item, {...item, username:'bruno', fullName:'Bruno', points: 18}, {...item, username:'carla', fullName:'Carla', points: 17}, {...item, username:'daniel', fullName:'Daniel', points: 12}]);
    const rows = root.querySelectorAll('tbody tr');
    expect(rows.length).toBe(4);
    expect(Array.from(rows).map(row => row.classList.contains('podium'))).toEqual([true,true,true,false]);
    expect(Array.from(rows).map(row => row.querySelector('td strong')?.textContent?.trim())).toEqual(['1','2','3','4']);
    expect(rows[3].textContent).toContain('Daniel');
  });

  it('keeps historical unlinked-player label and username fallback', () => {
    const root = render([{...item, username:null, fullName:'Jogador Histórico'}, {...item, fullName:null}]);
    const rows = root.querySelectorAll('tbody tr');
    expect(rows[0].textContent).toContain('Jogador Histórico');
    expect(rows[0].querySelector('.ranking-player span')).not.toBeNull();
    expect(rows[1].textContent).toContain('@ana');
  });

  it('preserves no-ranking empty state without adding fictional results', () => {
    const root = render([]);
    expect(root.querySelector('table')).toBeNull();
    expect(root.querySelector('.module-empty.compact h3')).not.toBeNull();
    expect(root.querySelector('.module-empty.compact p')).not.toBeNull();
  });

  it('shows real account avatars, with initials fallback for historic players', () => {
    const root = render([
      {...item, profilePicUrl:'https://images.example.com/ana.jpg'},
      {...item, username:null, profileId:null, fullName:'Ferreirinha', profilePicUrl:null}
    ]);
    const rows = root.querySelectorAll('tbody tr');
    const img = rows[0].querySelector<HTMLImageElement>('.ranking-player__avatar img');
    expect(img?.getAttribute('src')).toBe('https://images.example.com/ana.jpg');
    expect(rows[1].querySelector('.ranking-player__avatar')?.textContent?.trim()).toBe('F');
    expect(rows[1].querySelector('img')).toBeNull();
    expect(root.querySelectorAll('thead th').length).toBe(7);
  });
});
