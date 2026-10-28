import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { JynloSelectComponent } from './jynlo-select.component';

@Component({
  standalone: true,
  imports: [FormsModule, JynloSelectComponent],
  template: `<app-jynlo-select name="country" [(ngModel)]="country"
    [options]="choices" [searchable]="true"
    [disabled]="disabled" [blocked]="disabled"
    ariaLabel="País" placeholder="Selecionar país"></app-jynlo-select>`
})
class SelectHost {
  country = 'Portugal';
  disabled = false;
  choices = [
    {value:'Angola', label:'Angola'},
    {value:'Portugal', label:'Portugal'},
    {value:'África do Sul', label:'África do Sul'}
  ];
}

describe('JynloSelectComponent (Angular forms integration)', () => {
  let fixture: ComponentFixture<SelectHost>;
  beforeEach(async () => {
    await TestBed.configureTestingModule({imports:[SelectHost]}).compileComponents();
    fixture = TestBed.createComponent(SelectHost);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('shows the exact existing value and preserves ngModel string identity when changed', async () => {
    const page = fixture.nativeElement as HTMLElement;
    expect(page.querySelector('.jynlo-select__value')?.textContent?.trim()).toBe('Portugal');
    page.querySelector<HTMLButtonElement>('.jynlo-select__trigger')!.click();
    fixture.detectChanges();
    const search=page.querySelector<HTMLInputElement>('.jynlo-select__search')!;
    search.value = 'angola';
    search.dispatchEvent(new Event('input', {bubbles:true}));
    fixture.detectChanges();
    const opts=page.querySelectorAll<HTMLButtonElement>('.jynlo-select__option');
    expect(opts.length).toBe(1);
    expect(opts[0].textContent).toContain('Angola');
    opts[0].click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.componentInstance.country).toBe('Angola');
    expect(page.querySelector('.jynlo-select__options')).toBeNull();
    expect(page.querySelector('.jynlo-select__value')?.textContent).toContain('Angola');
  });

  it('searches ignoring diacritics and does not emit updates until an option is selected', () => {
    const root=fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('.jynlo-select__trigger')!.click();
    fixture.detectChanges();
    const field=root.querySelector<HTMLInputElement>('.jynlo-select__search')!;
    field.value='africa';
    field.dispatchEvent(new Event('input', {bubbles:true}));
    fixture.detectChanges();
    const opts=root.querySelectorAll('.jynlo-select__option');
    expect(opts.length).toBe(1);
    expect(opts[0].textContent).toContain('África do Sul');
    expect(fixture.componentInstance.country).toBe('Portugal');
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
    fixture.detectChanges();
    expect(root.querySelector('.jynlo-select__popover')).toBeNull();
    expect(fixture.componentInstance.country).toBe('Portugal');
  });

  it('respects disabled state and never opens a choice panel', async () => {
    fixture.componentInstance.disabled=true;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    const root=fixture.nativeElement as HTMLElement;
    const trigger=root.querySelector<HTMLButtonElement>('.jynlo-select__trigger')!;
    expect(trigger.disabled).toBeTrue();
    trigger.click();
    fixture.detectChanges();
    expect(root.querySelector('.jynlo-select__popover')).toBeNull();
  });
});
