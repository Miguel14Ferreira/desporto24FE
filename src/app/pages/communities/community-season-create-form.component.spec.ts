import { TestBed } from '@angular/core/testing';
import { CommunitySeasonCreateFormComponent } from './community-season-create-form.component';

describe('CommunitySeasonCreateFormComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({imports:[CommunitySeasonCreateFormComponent]}).compileComponents();
  });
  async function render(saving=false) {
    const fixture=TestBed.createComponent(CommunitySeasonCreateFormComponent);
    fixture.componentRef.setInput('name','Época 2026');
    fixture.componentRef.setInput('startsAt','2026-10-26T19:00');
    fixture.componentRef.setInput('saving',saving);
    fixture.detectChanges();
    await fixture.whenStable();fixture.detectChanges();
    return fixture;
  }
  it('keeps date/time input, draft name and the native creation button', async () => {
    const root=(await render()).nativeElement as HTMLElement;
    const inputs=root.querySelectorAll<HTMLInputElement>('input');
    expect(inputs.length).toBe(2);
    expect(inputs[0].value).toBe('Época 2026');
    expect(inputs[1].type).toBe('datetime-local');
    expect(inputs[1].value).toBe('2026-10-26T19:00');
    expect(root.querySelector('button')?.getAttribute('type')).toBe('button');
  });
  it('emits draft changes separately without creating a season by itself', async () => {
    const fixture=await render();
    const name=jasmine.createSpy('name'),date=jasmine.createSpy('date'),create=jasmine.createSpy('create');
    fixture.componentInstance.nameChange.subscribe(name);
    fixture.componentInstance.startsAtChange.subscribe(date);
    fixture.componentInstance.createRequested.subscribe(create);
    const inputs=(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLInputElement>('input');
    inputs[0].value='Nova época';inputs[0].dispatchEvent(new Event('input',{bubbles:true}));
    await fixture.whenStable();
    expect(name).toHaveBeenCalledOnceWith('Nova época');
    expect(date).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
    (fixture.nativeElement as HTMLElement).querySelector('button')?.click();
    expect(create).toHaveBeenCalledTimes(1);
  });
  it('disables creating during persistence without erasing the draft', async () => {
    const root=(await render(true)).nativeElement as HTMLElement;
    expect(root.querySelector<HTMLButtonElement>('button')?.disabled).toBeTrue();
    expect(root.querySelector<HTMLInputElement>('input')?.value).toBe('Época 2026');
  });
});
