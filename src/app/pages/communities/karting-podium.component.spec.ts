import { TestBed } from '@angular/core/testing';
import { I18nService, preloadEnglishTranslations } from '../../i18n/i18n.service';
import { CommunityTournament, TournamentRaceStanding } from '../model/community-tournament';
import { KartingPodiumComponent } from './karting-podium.component';

describe('KartingPodiumComponent', () => {
  let originalLanguage: string | null;
  const tournament: CommunityTournament = {
    id: 19, name: 'Campeonato do Cacém', sport: 'Karting', scoringMode: 'RACE_POINTS',
    format: 'LEAGUE', status: 'COMPLETED',
    winPoints: 3, drawPoints: 1, lossPoints: 0,
    createdAt: '2026-10-01T00:00:00Z', startedAt: '2026-10-02T00:00:00Z',
    completedAt: '2026-10-23T12:00:00Z',
    championProfileId: 11, championUsername: 'driver11',
    championDisplayName: 'Condutor 11', championPoints: 50, championTied: false
  };
  const drivers: TournamentRaceStanding[] = [
    { position: 1, playerId: 11, fullName: 'Condutor 11', races: 3, wins: 2,
      podiums: 3, bestFinish: 1, championshipPoints: 50, penaltyPoints: 0 },
    { position: 2, playerId: 12, fullName: 'Condutor 12', races: 3, wins: 1,
      podiums: 2, bestFinish: 1, championshipPoints: 42, penaltyPoints: 0 },
    { position: 3, playerId: 13, fullName: null, races: 3, wins: 0,
      podiums: 1, bestFinish: 3, championshipPoints: 32, penaltyPoints: 0 }
  ];

  beforeEach(async () => {
    originalLanguage = localStorage.getItem('d24-language');
    localStorage.setItem('d24-language', 'pt');
    await TestBed.configureTestingModule({ imports: [KartingPodiumComponent] }).compileComponents();
  });

  afterEach(() => {
    if (originalLanguage === null) {
      localStorage.removeItem('d24-language');
    } else {
      localStorage.setItem('d24-language', originalLanguage);
    }
  });

  function render(tournamentInput: CommunityTournament = tournament) {
    const fixture = TestBed.createComponent(KartingPodiumComponent);
    fixture.componentRef.setInput('tournament', tournamentInput);
    fixture.componentRef.setInput('podium', drivers);
    fixture.detectChanges();
    return fixture;
  }

  it('preserves the archived positions, medals, names and totals', () => {
    const root = render().nativeElement as HTMLElement;
    const places = root.querySelectorAll('.karting-podium-place');
    expect(places.length).toBe(3);
    expect(places[0].classList.contains('is-first')).toBeTrue();
    expect(places[1].classList.contains('is-second')).toBeTrue();
    expect(places[2].classList.contains('is-third')).toBeTrue();
    expect(places[0].textContent).toContain('🥇');
    expect(places[1].textContent).toContain('🥈');
    expect(places[2].textContent).toContain('🥉');
    expect(root.textContent).toContain('Condutor 11');
    expect(root.textContent).toContain('50');
    expect(root.textContent).toContain('23/10/2026');
    expect(root.querySelector('.karting-shared-title')).toBeNull();
  });

  it('shows the official shared-title notice only for tied champions', () => {
    const root = render({ ...tournament, championTied: true }).nativeElement as HTMLElement;
    expect(root.querySelector('.karting-shared-title[role="status"]')).not.toBeNull();
  });

  it('keeps the podium labels translated when English is selected', async () => {
    await preloadEnglishTranslations();
    TestBed.inject(I18nService).setLanguage('en');
    const root = render().nativeElement as HTMLElement;
    expect(root.textContent).toContain('Campeonato do Cacém');
    expect(root.textContent).toContain('Condutor 11');
    expect(root.querySelector('.karting-podium-medal')).not.toBeNull();
  });
});
