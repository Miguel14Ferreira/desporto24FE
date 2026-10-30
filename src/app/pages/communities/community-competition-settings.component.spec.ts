import { TestBed } from '@angular/core/testing';
import { CommunityCompetitionSettingsComponent } from './community-competition-settings.component';

describe('CommunityCompetitionSettingsComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({imports:[CommunityCompetitionSettingsComponent]}).compileComponents();
  });
  async function render(saving=false, enabled=true) {
    const fixture=TestBed.createComponent(CommunityCompetitionSettingsComponent);
    fixture.componentRef.setInput('enabled',enabled);
    fixture.componentRef.setInput('winPoints',3);
    fixture.componentRef.setInput('drawPoints',1);
    fixture.componentRef.setInput('lossPoints',0);
    fixture.componentRef.setInput('saving',saving);
    fixture.detectChanges();
    await fixture.whenStable();fixture.detectChanges();
    return fixture;
  }
  it('preserves the rankings switch and three numeric values', async () => {
    const root=(await render()).nativeElement as HTMLElement;
    expect(root.querySelector<HTMLInputElement>('input[type=checkbox]')?.checked).toBeTrue();
    expect(Array.from(root.querySelectorAll<HTMLInputElement>('input[type=number]')).map(x=>x.value)).toEqual(['3','1','0']);
    expect(root.querySelectorAll('input[type=number][min="0"]').length).toBe(3);
  });
  it('reports individual draft changes without editing another value', async () => {
    const fixture=await render();
    const win=jasmine.createSpy('win'),draw=jasmine.createSpy('draw'),loss=jasmine.createSpy('loss');
    fixture.componentInstance.winPointsChange.subscribe(win);
    fixture.componentInstance.drawPointsChange.subscribe(draw);
    fixture.componentInstance.lossPointsChange.subscribe(loss);
    const inputs=(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLInputElement>('input[type=number]');
    inputs[0].value='4'; inputs[0].dispatchEvent(new Event('input',{bubbles:true}));
    await fixture.whenStable();
    expect(win).toHaveBeenCalledOnceWith(4);
    expect(draw).not.toHaveBeenCalled();
    expect(loss).not.toHaveBeenCalled();
  });
  it('forwards enabled change and save request independently', async () => {
    const fixture=await render(false,false);
    const enabled=jasmine.createSpy('enabled'),save=jasmine.createSpy('save');
    fixture.componentInstance.enabledChange.subscribe(enabled);
    fixture.componentInstance.saveRequested.subscribe(save);
    (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('input[type=checkbox]')!.click();
    await fixture.whenStable();
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button.primary-action')!.click();
    expect(enabled).toHaveBeenCalledOnceWith(true);
    expect(save).toHaveBeenCalledTimes(1);
  });
  it('keeps the save button disabled during persistence but preserves all drafts', async () => {
    const root=(await render(true)).nativeElement as HTMLElement;
    expect(root.querySelector<HTMLButtonElement>('button.primary-action')?.disabled).toBeTrue();
    expect(root.querySelectorAll('input[type=number]').length).toBe(3);
  });
});
