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

  it('disables the trigger and choices through the component input and CVA contract', () => {
    // Isolate presentation from NgModel async scheduling: both consumers and
    // form controls may disable the component independently.
    const isolated=TestBed.createComponent(JynloSelectComponent);
    isolated.componentRef.setInput('blocked',true);
    isolated.detectChanges();
    const root=isolated.nativeElement as HTMLElement;
    const trigger=root.querySelector<HTMLButtonElement>('.jynlo-select__trigger')!;
    expect(isolated.componentInstance.disabled).toBeTrue();
    expect(trigger.disabled).toBeTrue();
    trigger.click();
    isolated.detectChanges();
    expect(root.querySelector('.jynlo-select__popover')).toBeNull();

    isolated.componentRef.setInput('blocked',false);
    isolated.detectChanges();
    isolated.componentInstance.setDisabledState(true);
    isolated.detectChanges();
    expect(isolated.componentInstance.disabled).toBeTrue();
    expect(trigger.disabled).toBeTrue();
    isolated.destroy();
  });

  it('keeps a country unchanged until Enter confirms a filtered option, without submitting the form', async () => {
    const root=fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('.jynlo-select__trigger')!.click();
    fixture.detectChanges();
    const input=root.querySelector<HTMLInputElement>('.jynlo-select__search')!;
    input.value='africa';
    input.dispatchEvent(new Event('input',{bubbles:true}));
    fixture.detectChanges();
    expect(fixture.componentInstance.country).toBe('Portugal');
    const enter=new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true});
    input.dispatchEvent(enter);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(enter.defaultPrevented).toBeTrue();
    expect(fixture.componentInstance.country).toBe('África do Sul');
  });

  it('keeps the fixed menu within the viewport and opens above a low trigger', () => {
    const root=fixture.nativeElement as HTMLElement;
    const trigger=root.querySelector<HTMLButtonElement>('.jynlo-select__trigger')!;
    const height=window.innerHeight;
    spyOn(trigger,'getBoundingClientRect').and.returnValue({
      left:24, right:324, top:height-75, bottom:height-28,
      width:300, height:47, x:24, y:height-75,
      toJSON:()=>({})
    } as DOMRect);
    trigger.click();
    fixture.detectChanges();
    const popover=root.querySelector<HTMLElement>('.jynlo-select__popover')!;
    const selector=fixture.debugElement.children[0].componentInstance as JynloSelectComponent;
    expect(selector.openAbove).toBeTrue();
    expect(popover.style.bottom).not.toBe('');
    expect(popover.style.left).toBe('24px');
    expect(getComputedStyle(popover).position).toBe('fixed');
  });

  it('closes a dropdown that becomes disabled and preserves the persisted form value', async () => {
    const root=fixture.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('.jynlo-select__trigger')!.click();
    fixture.detectChanges();
    fixture.componentInstance.disabled=true;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(root.querySelector('.jynlo-select__popover')).toBeNull();
    expect(fixture.componentInstance.country).toBe('Portugal');
  });
});
