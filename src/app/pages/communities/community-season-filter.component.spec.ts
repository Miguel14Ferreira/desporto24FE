import { TestBed } from '@angular/core/testing';
import { CommunitySeason } from '../model/community-group';
import { CommunitySeasonFilterComponent } from './community-season-filter.component';

describe('CommunitySeasonFilterComponent', () => {
  const season:CommunitySeason={
    id:4,name:'Época 2026',active:true,startsAt:'2026-10-01T00:00:00Z',endedAt:null,
    championUsername:null,championDisplayName:null,championPoints:null
  };
  beforeEach(async () => {
    await TestBed.configureTestingModule({imports:[CommunitySeasonFilterComponent]}).compileComponents();
  });
  async function render(selectedSeasonId:number|null, seasons:CommunitySeason[]= [season]) {
    const fixture=TestBed.createComponent(CommunitySeasonFilterComponent);
    fixture.componentRef.setInput('selectedSeasonId',selectedSeasonId);
    fixture.componentRef.setInput('seasons',seasons);
    fixture.detectChanges();await fixture.whenStable();fixture.detectChanges();
    return fixture;
  }
  it('keeps all-time option and marks active seasons without changing labels', async () => {
    const root=(await render(null)).nativeElement as HTMLElement;
    const options=root.querySelectorAll('option');
    expect(options.length).toBe(2);
    expect(options[1].textContent).toContain('Época 2026');
    expect(options[1].textContent).not.toBeNull();
  });
  it('honors a selected season id and emits null for all-time selection', async () => {
    const fixture=await render(4);
    const selected=fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    expect(selected.selectedIndex).toBe(1);
    const spy=jasmine.createSpy('selection');
    fixture.componentInstance.selectionChange.subscribe(spy);
    selected.selectedIndex=0;selected.dispatchEvent(new Event('change',{bubbles:true}));
    await fixture.whenStable();
    expect(spy).toHaveBeenCalledOnceWith(null);
  });
  it('keeps the filter available without historical seasons', async () => {
    const root=(await render(null,[])).nativeElement as HTMLElement;
    expect(root.querySelectorAll('option').length).toBe(1);
    expect(root.querySelector('select')).not.toBeNull();
  });
});
