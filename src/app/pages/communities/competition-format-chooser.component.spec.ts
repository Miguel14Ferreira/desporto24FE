import { TestBed } from '@angular/core/testing';
import { CompetitionFormatChooserComponent, TournamentCreationFormat } from './competition-format-chooser.component';

describe('CompetitionFormatChooserComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [CompetitionFormatChooserComponent] }).compileComponents();
  });

  function render(selected: TournamentCreationFormat = 'LEAGUE', disabled = false) {
    const fixture = TestBed.createComponent(CompetitionFormatChooserComponent);
    fixture.componentRef.setInput('selectedFormat', selected);
    fixture.componentRef.setInput('disabled', disabled);
    fixture.detectChanges();
    return fixture;
  }

  it('renders league, knockout and group knockout; emits choices without mutating the parent state', () => {
    const fixture = render('LEAGUE');
    const root = fixture.nativeElement as HTMLElement;
    const buttons = root.querySelectorAll<HTMLButtonElement>('.create-format-option');
    expect(buttons.length).toBe(3);
    expect(buttons[0].getAttribute('aria-pressed')).toBe('true');
    expect(buttons[1].getAttribute('aria-pressed')).toBe('false');
    const handler = jasmine.createSpy('format');
    fixture.componentInstance.formatSelected.subscribe(handler);
    buttons[1].click();
    buttons[2].click();
    expect(handler).toHaveBeenCalledWith('KNOCKOUT');
    expect(handler).toHaveBeenCalledWith('GROUP_KNOCKOUT');
    expect(fixture.componentInstance.selectedFormat).toBe('LEAGUE');
  });

  it('keeps format controls disabled during saving', () => {
    const fixture = render('GROUP_KNOCKOUT', true);
    const root = fixture.nativeElement as HTMLElement;
    const buttons = root.querySelectorAll<HTMLButtonElement>('.create-format-option');
    expect(buttons.length).toBe(3);
    expect(buttons[2].getAttribute('aria-pressed')).toBe('true');
    expect(Array.from(buttons).every(button => button.disabled)).toBeTrue();
    const handler = jasmine.createSpy('format');
    fixture.componentInstance.formatSelected.subscribe(handler);
    buttons[0].click();
    expect(handler).not.toHaveBeenCalled();
  });
});
