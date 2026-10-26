import { TestBed } from '@angular/core/testing';
import { CommunitySwitchComponent } from './community-switch.component';

describe('CommunitySwitchComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({imports:[CommunitySwitchComponent]}).compileComponents();
  });
  async function render(checked:boolean, label:string) {
    const fixture=TestBed.createComponent(CommunitySwitchComponent);
    fixture.componentRef.setInput('checked',checked);
    fixture.componentRef.setInput('label',label);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }
  it('provides a native, accessible checkbox and the original label', async () => {
    const root=(await render(true,'Classificações ativas')).nativeElement as HTMLElement;
    expect(root.querySelector<HTMLInputElement>('input[type=checkbox]')?.checked).toBeTrue();
    expect(root.querySelector('label span')?.textContent).toContain('Classificações ativas');
  });
  it('emits only on real checkbox changes and does not mutate the checked input itself', async () => {
    const fixture=await render(false,'Mostrar todos');
    const events:boolean[]=[];
    fixture.componentInstance.checkedChange.subscribe(value=>events.push(value));
    const checkbox=(fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('input')!;
    checkbox.click();
    await fixture.whenStable();
    expect(events).toEqual([true]);
    expect(fixture.componentInstance.checked).toBeFalse();
  });
});
