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
  it('distinguishes same-named seasons by sport while preserving shared history', async () => {
    const root=(await render(null, [
      {...season,id:11,name:'2026/27',sport:'Futebol'},
      {...season,id:12,name:'2026/27',sport:'Karting'},
      {...season,id:13,name:'2025/26',sport:null,active:false}
    ])).nativeElement as HTMLElement;
    const labels=Array.from(root.querySelectorAll('option')).map(option => option.textContent?.trim() || '');
    expect(labels[1]).toContain('Futebol · 2026/27');
    expect(labels[2]).toContain('Karting · 2026/27');
    expect(labels[3]).toContain('2025/26');
    expect(labels[3]).not.toContain('Futebol');
    expect(labels[3]).not.toContain('Karting');
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
