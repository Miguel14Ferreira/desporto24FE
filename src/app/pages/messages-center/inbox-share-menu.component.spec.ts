import { TestBed } from '@angular/core/testing';
import { InboxShareMenuComponent } from './inbox-share-menu.component';
describe('InboxShareMenuComponent',()=>{
  beforeEach(async()=>await TestBed.configureTestingModule({imports:[InboxShareMenuComponent]}).compileComponents());
  function render(ready:boolean){const f=TestBed.createComponent(InboxShareMenuComponent);f.componentRef.setInput('attachmentControlsReady',ready);f.detectChanges();return f;}
  it('preserves locked attachment state',()=>{
    const root=render(false).nativeElement as HTMLElement;
    expect(root.querySelectorAll('button').length).toBe(2);
    expect(root.querySelector<HTMLButtonElement>('button')?.disabled).toBeTrue();
  });
  it('only signals file and share intentions with no direct native file access',()=>{
    const f=render(true),file=jasmine.createSpy('file'),share=jasmine.createSpy('share');
    f.componentInstance.fileRequested.subscribe(file);f.componentInstance.shareRequested.subscribe(share);
    const root=f.nativeElement as HTMLElement;const buttons=root.querySelectorAll<HTMLButtonElement>('button');
    buttons[0].click();buttons[1].click();
    expect(file).toHaveBeenCalledTimes(1);expect(share).toHaveBeenCalledTimes(1);
    expect(root.querySelector('input[type=file]')).toBeNull();
  });
});
