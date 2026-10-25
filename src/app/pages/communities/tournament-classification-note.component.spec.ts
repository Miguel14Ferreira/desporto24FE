import { TestBed } from '@angular/core/testing';
import { TournamentClassificationNoteComponent } from './tournament-classification-note.component';

describe('TournamentClassificationNoteComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({imports: [TournamentClassificationNoteComponent]}).compileComponents();
  });
  function render(kind: 'profile' | 'inline' | 'race' | 'chess', unsupported = false) {
    const fixture = TestBed.createComponent(TournamentClassificationNoteComponent);
    fixture.componentRef.setInput('kind', kind);
    fixture.componentRef.setInput('heading', 'Official heading');
    fixture.componentRef.setInput('description', 'Official description');
    fixture.componentRef.setInput('fields', 'Required fields');
    fixture.componentRef.setInput('unsupported', unsupported);
    fixture.componentRef.setInput('raceSport', 'Karting');
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }
  it('shows profile-specific scoring guidance and unsupported indication', () => {
    const supported = render('profile');
    expect(supported.querySelector('.classification-profile')?.textContent).toContain('Official description');
    expect(supported.querySelector('.classification-notice')).toBeNull();
    const unsupported = render('profile', true);
    expect(unsupported.querySelector('.classification-notice[role="status"]')).not.toBeNull();
    expect(unsupported.querySelector('.classification-profile small')?.textContent).toContain('Required fields');
  });
  it('preserves inline speed, karting and chess fixed-point explanations', () => {
    const inline = render('inline');
    expect(inline.querySelector('.classification-fixed-points[role="note"]')).not.toBeNull();
    expect(inline.querySelector('.classification-profile')).toBeNull();
    const race = render('race');
    expect(race.querySelector('.classification-fixed-points')?.textContent).toContain('Karting');
    const chess = render('chess');
    expect(chess.querySelectorAll('.classification-fixed-points span').length).toBe(3);
  });
});
