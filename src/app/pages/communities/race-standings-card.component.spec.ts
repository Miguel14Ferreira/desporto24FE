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
    expect(root.querySelectorAll('thead th').length).toBe(8);
    expect(row?.querySelectorAll('td')[5].textContent?.trim()).toBe('1');
    expect(row?.querySelectorAll('td')[6].textContent?.trim()).toBe('0');
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
    expect(displayed[1].querySelectorAll('td')[7].textContent?.trim()).toBe('0');
    expect(rows[0].position).toBe(-1);
  });
  it('highlights official podium places, including ties, without inferring row order', () => {
    const rows: TournamentRaceStanding[] = [
      {...standings[0], playerId: 30, fullName: 'Quarto', position: 4},
      {...standings[0], playerId: 31, fullName: 'Segundo A', position: 2},
      {...standings[0], playerId: 32, fullName: 'Primeiro', position: 1},
      {...standings[0], playerId: 33, fullName: 'Segundo B', position: 2},
      {...standings[0], playerId: 34, fullName: 'Terceiro', position: 3},
      {...standings[0], playerId: 35, fullName: 'Desconhecido', position: -1}
    ];
    const root = render(rows);
    const resultRows = root.querySelectorAll<HTMLTableRowElement>('tbody tr');
    expect(resultRows.length).toBe(6);
    expect(resultRows[0].textContent).toContain('Quarto');
    expect(resultRows[0].classList.contains('is-podium-first')).toBeFalse();
    expect(resultRows[1].classList.contains('is-podium-second')).toBeTrue();
    expect(resultRows[2].classList.contains('is-podium-first')).toBeTrue();
    expect(resultRows[3].classList.contains('is-podium-second')).toBeTrue();
    expect(resultRows[4].classList.contains('is-podium-third')).toBeTrue();
    expect(resultRows[5].classList.contains('is-podium-third')).toBeFalse();
    expect(rows.map(row => row.position)).toEqual([4, 2, 1, 2, 3, -1]);
  });
  it('renders best finish and penalties from the API without deriving new standings', () => {
    const rows: TournamentRaceStanding[] = [{
      ...standings[0], bestFinish: null, penaltyPoints: -1,
      championshipPoints: 18
    }, {
      ...standings[0], playerId: 24, position: 2,
      fullName: 'Piloto B', bestFinish: 3, penaltyPoints: 5,
      championshipPoints: 8
    }];
    const root = render(rows);
    const displayed = root.querySelectorAll<HTMLTableRowElement>('tbody tr');
    expect(displayed[0].querySelectorAll('td')[5].textContent?.trim()).toBe('—');
    expect(displayed[0].querySelectorAll('td')[6].textContent?.trim()).toBe('—');
    expect(displayed[0].querySelectorAll('td')[7].textContent?.trim()).toBe('18');
    expect(displayed[1].querySelectorAll('td')[5].textContent?.trim()).toBe('3');
    expect(displayed[1].querySelectorAll('td')[6].textContent?.trim()).toBe('5');
    expect(displayed[1].querySelectorAll('td')[7].textContent?.trim()).toBe('8');
    expect(rows[1].championshipPoints).toBe(8);
  });
  it('shows an empty-state notice instead of an empty results table', () => {
    const root = render([]);
    expect(root.querySelector('table')).toBeNull();
    expect(root.querySelector('.t-muted')).not.toBeNull();
  });
});
