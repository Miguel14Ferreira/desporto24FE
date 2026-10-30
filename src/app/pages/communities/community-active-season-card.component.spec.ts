import { TestBed } from '@angular/core/testing';
import { CommunityActiveSeasonCardComponent } from './community-active-season-card.component';

describe('CommunityActiveSeasonCardComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [CommunityActiveSeasonCardComponent] }).compileComponents();
  });

  function render(confirming = false, saving = false) {
    const fixture = TestBed.createComponent(CommunityActiveSeasonCardComponent);
    fixture.componentRef.setInput('name', 'Época de 2026');
    fixture.componentRef.setInput('confirming', confirming);
    fixture.componentRef.setInput('saving', saving);
    fixture.detectChanges();
    return fixture;
  }

  it('keeps the active season name and requests confirmation without closing automatically', () => {
    const fixture = render();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.active-season-card strong')?.textContent).toContain('Época de 2026');
    expect(root.querySelector('.season-close-confirmation')).toBeNull();
    const request = jasmine.createSpy('request');
    const confirm = jasmine.createSpy('confirm');
    fixture.componentInstance.requestClose.subscribe(request);
    fixture.componentInstance.confirmClose.subscribe(confirm);
    root.querySelector<HTMLButtonElement>('button')?.click();
    expect(request).toHaveBeenCalledTimes(1);
    expect(confirm).not.toHaveBeenCalled();
  });

  it('keeps explicit confirm and cancel events separate', () => {
    const fixture = render(true);
    const root = fixture.nativeElement as HTMLElement;
    const confirm = jasmine.createSpy('confirm');
    const cancel = jasmine.createSpy('cancel');
    fixture.componentInstance.confirmClose.subscribe(confirm);
    fixture.componentInstance.cancelClose.subscribe(cancel);
    const buttons = root.querySelectorAll<HTMLButtonElement>('.season-close-confirmation button');
    expect(buttons.length).toBe(2);
    buttons[0].click();
    buttons[1].click();
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledTimes(1);
  });

  it('disables both actions while the original close operation is saving', () => {
    const root = render(true, true).nativeElement as HTMLElement;
    const buttons = root.querySelectorAll<HTMLButtonElement>('.season-close-confirmation button');
    expect(buttons.length).toBe(2);
    expect(Array.from(buttons).every(button => button.disabled)).toBeTrue();
  });
});
