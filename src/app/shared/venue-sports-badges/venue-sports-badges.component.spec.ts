import { TestBed } from '@angular/core/testing';
import { I18nService, preloadEnglishTranslations } from '../../i18n/i18n.service';
import { parseVenueSports, VenueSportsBadgesComponent } from './venue-sports-badges.component';

describe('Venue sports badges', () => {
  it('parses both legacy separators, trims entries, and removes repeated names', () => {
    expect(parseVenueSports(' Futebol;Futsal; Ginástica, Ténis;futsal;; '))
      .toEqual(['Futebol', 'Futsal', 'Ginástica', 'Ténis']);
    expect(parseVenueSports(null)).toEqual([]);
    expect(parseVenueSports('  ;  ')).toEqual([]);
    expect(parseVenueSports('Futebol|Futsal; Natação, Pilates | Futsal'))
      .toEqual(['Futebol', 'Futsal', 'Natação', 'Pilates']);
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VenueSportsBadgesComponent]
    }).compileComponents();
  });

  it('renders individual readable badges without a semicolon list', () => {
    const fixture = TestBed.createComponent(VenueSportsBadgesComponent);
    fixture.componentInstance.sports = 'Futebol;Futsal;Ginásio;Ginástica;Rítmica;Judo';
    fixture.detectChanges();
    const chips = fixture.nativeElement.querySelectorAll('.venue-sports-chip');
    expect(chips.length).toBe(6);
    expect(Array.from(chips).map((chip: any) => chip.textContent.trim()))
      .toEqual(['Futebol', 'Futsal', 'Ginásio', 'Ginástica', 'Rítmica', 'Judo']);
    expect(fixture.nativeElement.querySelector('.venue-sports-counter')).toBeNull();
    fixture.destroy();
  });

  it('shows a noninteractive +N counter for venue catalogue cards', () => {
    const fixture = TestBed.createComponent(VenueSportsBadgesComponent);
    fixture.componentInstance.sports = 'Futebol;Futsal;Ginásio;Ginástica;Judo';
    fixture.componentInstance.limit = 3;
    fixture.componentInstance.compact = true;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.venue-sports-chip').length).toBe(3);
    expect(fixture.nativeElement.querySelector('.venue-sports-counter')?.textContent.trim()).toBe('+2');
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
    fixture.destroy();
  });

  it('expands and collapses complete sports without altering the underlying value', () => {
    const fixture = TestBed.createComponent(VenueSportsBadgesComponent);
    fixture.componentInstance.sports = 'Futebol;Futsal;Ginásio;Ginástica;Judo';
    fixture.componentInstance.limit = 2;
    fixture.componentInstance.expandable = true;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.venue-sports-chip').length).toBe(2);
    (fixture.nativeElement.querySelector('.venue-sports-more') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.venue-sports-chip').length).toBe(5);
    expect(fixture.nativeElement.querySelector('.venue-sports-more')?.getAttribute('aria-expanded')).toBe('true');
    (fixture.nativeElement.querySelector('.venue-sports-more') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.venue-sports-chip').length).toBe(2);
    fixture.destroy();
  });

  it('updates when switching venues and never retains the previous expanded list', () => {
    const fixture = TestBed.createComponent(VenueSportsBadgesComponent);
    fixture.componentInstance.limit = 1;
    fixture.componentInstance.expandable = true;
    fixture.componentRef.setInput('sports', 'Futebol;Futsal;Judo');
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.venue-sports-more') as HTMLButtonElement).click();
    fixture.detectChanges();
    fixture.componentRef.setInput('sports', 'Natação');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.venue-sports-chip').length).toBe(1);
    expect(fixture.nativeElement.querySelector('.venue-sports-chip')?.textContent.trim()).toBe('Natação');
    expect(fixture.nativeElement.querySelector('.venue-sports-more')).toBeNull();
    fixture.destroy();
  });
  it('localizes sports chips immediately when the selected UI language changes', async () => {
    await preloadEnglishTranslations();
    const old = localStorage.getItem('d24-language');
    const i18n = TestBed.inject(I18nService);
    const fixture = TestBed.createComponent(VenueSportsBadgesComponent);
    fixture.componentInstance.sports = 'Canoagem;Windsurf;Stand Up Paddle';
    try {
      i18n.setLanguage('pt');
      fixture.detectChanges();
      expect(Array.from(fixture.nativeElement.querySelectorAll('.venue-sports-chip'))
        .map((chip: any) => chip.textContent.trim())).toEqual(['Canoagem', 'Windsurf', 'Stand Up Paddle']);
      i18n.setLanguage('en');
      fixture.detectChanges();
      expect(Array.from(fixture.nativeElement.querySelectorAll('.venue-sports-chip'))
        .map((chip: any) => chip.textContent.trim()))
        .toEqual(['Canoeing', 'Windsurfing', 'Stand-up paddleboarding']);
      // Canonical API-sourced names are not modified for search and submission.
      expect(fixture.componentInstance.items).toEqual(['Canoagem', 'Windsurf', 'Stand Up Paddle']);
    } finally {
      i18n.setLanguage(old === 'en' ? 'en' : 'pt');
      if (old === null) localStorage.removeItem('d24-language');
      fixture.destroy();
    }
  });

});
