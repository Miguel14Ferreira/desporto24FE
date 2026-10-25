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
  it('shows an empty-state notice instead of an empty results table', () => {
    const root = render([]);
    expect(root.querySelector('table')).toBeNull();
    expect(root.querySelector('.t-muted')).not.toBeNull();
  });
});
