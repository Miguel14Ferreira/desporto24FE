import { TestBed } from '@angular/core/testing';
import { CommunityOverviewStatsComponent } from './community-overview-stats.component';

describe('CommunityOverviewStatsComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [CommunityOverviewStatsComponent] }).compileComponents();
  });

  function render(values: { count?: number; sports?: string[]; visibility?: string; rankings?: boolean } = {}) {
    const fixture = TestBed.createComponent(CommunityOverviewStatsComponent);
    fixture.componentRef.setInput('memberCount', values.count ?? 14);
    fixture.componentRef.setInput('sports', values.sports ?? ['Futebol', 'Futsal']);
    fixture.componentRef.setInput('visibility', values.visibility ?? 'PRIVATE');
    fixture.componentRef.setInput('rankingsEnabled', values.rankings ?? true);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('keeps four read-only cards in their existing order', () => {
    const cards = render().querySelectorAll<HTMLElement>('.overview-card');
    expect(cards.length).toBe(4);
    expect(cards[0].querySelector('strong')?.textContent?.trim()).toBe('14');
    expect(cards[1].querySelector('strong')?.textContent?.trim()).toBe('Futebol, Futsal');
    expect(cards[2].querySelector('strong')?.textContent?.trim()).toBeTruthy();
    expect(cards[3].querySelector('strong')?.textContent?.trim()).toBeTruthy();
    expect(render().querySelector('button, input, a')).toBeNull();
  });

  it('preserves the original no-sport fallback and public/no-rankings view', () => {
    const cards = render({count: 0, sports: [], visibility: 'PUBLIC', rankings: false})
      .querySelectorAll<HTMLElement>('.overview-card');
    expect(cards[0].querySelector('strong')?.textContent?.trim()).toBe('0');
    expect(cards[1].querySelector('strong')?.textContent).toContain('Sem modalidade definida');
    expect(cards[2].textContent?.trim()).toBeTruthy();
    expect(cards[3].textContent?.trim()).toBeTruthy();
  });
});
