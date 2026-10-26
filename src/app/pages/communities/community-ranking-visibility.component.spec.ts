import { TestBed } from '@angular/core/testing';
import { CommunityRankingVisibilityComponent } from './community-ranking-visibility.component';

describe('CommunityRankingVisibilityComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({imports:[CommunityRankingVisibilityComponent]}).compileComponents();
  });
  it('shows only one toggle and does not calculate or display rankings', async () => {
    const fixture=TestBed.createComponent(CommunityRankingVisibilityComponent);
    fixture.componentRef.setInput('showAll',true);
    fixture.detectChanges();
    await fixture.whenStable();fixture.detectChanges();
    const root=fixture.nativeElement as HTMLElement;
    expect(root.querySelector<HTMLInputElement>('input[type=checkbox]')?.checked).toBeTrue();
    expect(root.querySelectorAll('table,button')).toHaveSize(0);
    expect(root.querySelector('.ranking-controls')).not.toBeNull();
  });
  it('forwards member visibility changes to the parent without changing the parent state', async () => {
    const fixture=TestBed.createComponent(CommunityRankingVisibilityComponent);
    fixture.componentRef.setInput('showAll',false);
    fixture.detectChanges();await fixture.whenStable();fixture.detectChanges();
    const spy=jasmine.createSpy('showAll');
    fixture.componentInstance.showAllChange.subscribe(spy);
    (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('input')!.click();
    await fixture.whenStable();
    expect(spy).toHaveBeenCalledOnceWith(true);
    expect(fixture.componentInstance.showAll).toBeFalse();
  });
});
