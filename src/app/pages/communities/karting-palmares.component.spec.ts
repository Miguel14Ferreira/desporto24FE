import { TestBed } from '@angular/core/testing';
import { preloadEnglishTranslations } from '../../i18n/i18n.service';
import { CommunityTournament } from '../model/community-tournament';
import { KartingPalmaresComponent } from './karting-palmares.component';

describe('KartingPalmaresComponent', () => {
  let previous: string | null;
  const race: CommunityTournament = {
    id: 11, name: 'Taça de outubro', sport: 'Karting', scoringMode: 'RACE_POINTS',
    format: 'LEAGUE', status: 'COMPLETED',
    winPoints: 3, drawPoints: 1, lossPoints: 0,
    createdAt: '2026-10-01T00:00:00Z', startedAt: '2026-10-02T00:00:00Z',
    completedAt: '2026-10-24T12:00:00Z', championProfileId: 1,
    championUsername: 'alpha', championDisplayName: 'Piloto A',
    championPoints: 44, championTied: false
  };
  const tiedRace: CommunityTournament = {
    ...race, id: 12, name: 'BMX em equipa', sport: 'BMX', championTied: true
  };

  beforeEach(async () => {
    previous = localStorage.getItem('d24-language');
    localStorage.setItem('d24-language', 'pt');
    await TestBed.configureTestingModule({ imports: [KartingPalmaresComponent] }).compileComponents();
  });
  afterEach(() => {
    if (previous == null) localStorage.removeItem('d24-language');
    else localStorage.setItem('d24-language', previous);
  });

  function render(races: CommunityTournament[] = [race, tiedRace], selectedId: number | null = 12) {
    const fixture = TestBed.createComponent(KartingPalmaresComponent);
    fixture.componentRef.setInput('tournaments', races);
    fixture.componentRef.setInput('selectedId', selectedId);
    fixture.componentRef.setInput('hasMore', true);
    fixture.detectChanges();
    return fixture;
  }

  it('shows the archived winner, shared-champion label, dates and selection', () => {
    const fixture = render();
    const root = fixture.nativeElement as HTMLElement;
    const buttons = root.querySelectorAll<HTMLButtonElement>('.karting-palmares-item');
    expect(buttons.length).toBe(2);
    expect(buttons[0].textContent).toContain('Piloto A');
    expect(buttons[0].textContent).toContain('24/10/2026');
    expect(buttons[1].textContent).toContain('BMX Racing');
    expect(buttons[1].getAttribute('aria-pressed')).toBe('true');
    expect(root.querySelector('.karting-palmares-more')).not.toBeNull();
    const handler = jasmine.createSpy('selected');
    fixture.componentInstance.tournamentSelected.subscribe(handler);
    buttons[1].click();
    expect(handler).toHaveBeenCalledOnceWith(tiedRace);
  });

  it('keeps the no-archive state and optional pagination notice', () => {
    const fixture = render([], null);
    fixture.componentRef.setInput('hasMore', false);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelectorAll('.karting-palmares-item').length).toBe(0);
    expect(root.querySelector('.t-muted')).not.toBeNull();
    expect(root.querySelector('.karting-palmares-more')).toBeNull();
  });

  it('preserves the same output data for English visitors', async () => {
    await preloadEnglishTranslations();
    localStorage.setItem('d24-language', 'en');
    const root = render().nativeElement as HTMLElement;
    expect(root.textContent).toContain('Taça de outubro');
    expect(root.textContent).toContain('Piloto A');
    expect(root.textContent).toContain('BMX Racing');
  });
});
