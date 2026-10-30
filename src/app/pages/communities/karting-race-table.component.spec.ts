import { TestBed } from '@angular/core/testing';
import { preloadEnglishTranslations } from '../../i18n/i18n.service';
import { TournamentRaceRound } from '../model/community-tournament';
import { KartingRaceTableComponent } from './karting-race-table.component';

describe('KartingRaceTableComponent', () => {
  let previous: string | null;
  const race: TournamentRaceRound = {
    id: 5, name: 'Jornada 3', sport: 'Karting', playedAt: '2026-10-24T18:00:00Z',
    entries: [
      {
        communityPlayerId: 1, fullName: 'Piloto A', finishPosition: 1,
        elapsedSeconds: 92.25, bestLapSeconds: 29.125, lapsCompleted: 5,
        adjustedElapsedSeconds: 93.25, raceTimePenaltySeconds: 1,
        racePenaltyPoints: 3, racePenaltyReason: 'Largada',
        raceDisqualified: false
      },
      {
        communityPlayerId: 2, fullName: 'Piloto B', finishPosition: null,
        elapsedSeconds: null, bestLapSeconds: null, racePenaltyPoints: 0,
        raceDisqualified: false
      },
      {
        communityPlayerId: 3, fullName: 'Piloto C', finishPosition: 2,
        elapsedSeconds: 105, bestLapSeconds: 31, racePenaltyPoints: 0,
        raceDisqualified: true, raceStewardReason: 'Decisão dos comissários'
      }
    ]
  };

  beforeEach(async () => {
    previous = localStorage.getItem('d24-language');
    localStorage.setItem('d24-language', 'pt');
    await TestBed.configureTestingModule({ imports: [KartingRaceTableComponent] }).compileComponents();
  });
  afterEach(() => {
    if (previous == null) localStorage.removeItem('d24-language');
    else localStorage.setItem('d24-language', previous);
  });

  function render(data: TournamentRaceRound = race, sport = 'Karting') {
    const fixture = TestBed.createComponent(KartingRaceTableComponent);
    fixture.componentRef.setInput('race', data);
    fixture.componentRef.setInput('sport', sport);
    fixture.componentRef.setInput('pointsByPlace', [25, 18, 15]);
    fixture.detectChanges();
    return fixture;
  }

  it('keeps the race position ordering, DSQ/DNF and original penalties', () => {
    const root = render().nativeElement as HTMLElement;
    const rows = root.querySelectorAll<HTMLTableRowElement>('tbody tr');
    expect(rows.length).toBe(3);
    expect(rows[0].textContent).toContain('Piloto A');
    expect(rows[1].textContent).toContain('Piloto B');
    expect(rows[1].textContent).toContain('DNF');
    expect(rows[2].textContent).toContain('Piloto C');
    expect(rows[2].textContent).toContain('DSQ');
    expect(rows[2].classList.contains('is-disqualified')).toBeTrue();
    expect(rows[0].querySelector('.karting-race-award')?.textContent?.trim()).toBe('22');
    expect(rows[2].querySelector('.karting-race-award')?.textContent?.trim()).toBe('0');
    expect(rows[0].textContent).toContain('01:33.250');
    expect(rows[0].textContent).toContain('Largada');
    expect(root.textContent).toContain('Decisão dos comissários');
  });

  it('renders the optional lap and best-lap columns only when data supplies them', () => {
    const fixture = render({
      ...race, entries: race.entries.map(entry => ({
        ...entry, lapsCompleted: null, bestLapSeconds: null
      }))
    });
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelectorAll('thead th').length).toBe(4);
    expect(root.querySelectorAll('tbody tr').length).toBe(3);
  });

  it('retains PT/EN content and shows non-Karting race athletes', async () => {
    await preloadEnglishTranslations();
    localStorage.setItem('d24-language', 'en');
    const root = render(race, 'BMX').nativeElement as HTMLElement;
    expect(root.querySelectorAll('tbody tr').length).toBe(3);
    expect(root.textContent).toContain('Piloto A');
    expect(root.querySelector('table')?.getAttribute('aria-label')).toContain('Jornada 3');
  });
});
