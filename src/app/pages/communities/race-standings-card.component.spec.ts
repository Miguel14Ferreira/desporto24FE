import { TestBed } from '@angular/core/testing';
import { RaceStandingsCardComponent } from './race-standings-card.component';
import { TournamentRaceStanding } from '../model/community-tournament';

describe('RaceStandingsCardComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({imports: [RaceStandingsCardComponent]}).compileComponents();
  });
  const standings: TournamentRaceStanding[] = [{
    playerId: 22, position: 1, fullName: 'Piloto A', races: 3,
    wins: 2, podiums: 3, bestFinish: 1, championshipPoints: 45, penaltyPoints: 0
  }];
  function render(rows: TournamentRaceStanding[]) {
    const fixture = TestBed.createComponent(RaceStandingsCardComponent);
    fixture.componentRef.setInput('standings', rows);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }
  it('keeps the official archived positions, races and points without reordering', () => {
    const root = render(standings);
    const row = root.querySelector('tbody tr');
    expect(root.querySelectorAll('tbody tr').length).toBe(1);
    expect(row?.textContent).toContain('Piloto A');
    expect(row?.textContent).toContain('45');
    expect(row?.textContent).toContain('3');
    expect(root.querySelector('table[aria-label]')).not.toBeNull();
  });
  it('keeps original API order but hides invalid numeric standings values', () => {
    const rows: TournamentRaceStanding[] = [
      {...standings[0], position: -1, races: -2, wins: NaN,
        podiums: Infinity, championshipPoints: NaN},
      {...standings[0], playerId: 23, position: 2, fullName: 'Piloto B',
        races: 0, wins: 0, podiums: 0, championshipPoints: 0}
    ];
    const root = render(rows);
    const displayed = root.querySelectorAll<HTMLTableRowElement>('tbody tr');
    expect(displayed.length).toBe(2);
    expect(displayed[0].textContent).toContain('Piloto A');
    expect(displayed[1].textContent).toContain('Piloto B');
    expect(displayed[0].textContent).not.toContain('NaN');
    expect(displayed[0].textContent).not.toContain('Infinity');
    expect(displayed[0].textContent).not.toContain('-2');
    expect(displayed[0].querySelectorAll('td')[0].textContent?.trim()).toBe('—');
    expect(displayed[1].querySelectorAll('td')[5].textContent?.trim()).toBe('0');
    expect(rows[0].position).toBe(-1);
  });
  it('shows an empty-state notice instead of an empty results table', () => {
    const root = render([]);
    expect(root.querySelector('table')).toBeNull();
    expect(root.querySelector('.t-muted')).not.toBeNull();
  });
});
