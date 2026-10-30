import { TestBed } from '@angular/core/testing';
import { InboxSharePickerComponent } from './inbox-share-picker.component';
import { ShareChoice } from './share-message';
describe('InboxSharePickerComponent',()=>{
  const person:ShareChoice={kind:'profile',id:'ana',title:'Ana',subtitle:'Jogadora'};
  const group:ShareChoice={kind:'community',id:'8',title:'Futebol',subtitle:'Comunidade'};
  beforeEach(async()=>await TestBed.configureTestingModule({imports:[InboxSharePickerComponent]}).compileComponents());
  async function render(values:Partial<InboxSharePickerComponent>={}){
    const f=TestBed.createComponent(InboxSharePickerComponent);
    f.componentRef.setInput('choices',[person,group]);
    for(const [k,v] of Object.entries(values)) f.componentRef.setInput(k,v);
    f.detectChanges();await f.whenStable();f.detectChanges();return f;
  }
  it('retains three tabs, selection and order',async()=>{
    const root=(await render()).nativeElement as HTMLElement;
    expect(root.querySelectorAll('[role=tab]').length).toBe(3);
    expect(root.querySelector('[role=tab]')?.getAttribute('aria-selected')).toBe('true');
    expect(root.querySelectorAll('.inbox-share-option').length).toBe(2);
  });
  it('emits tab, search, original choice and close without navigating or sending',async()=>{
    const f=await render(),tab=jasmine.createSpy('tab'),search=jasmine.createSpy('search'),
      choice=jasmine.createSpy('choice'),close=jasmine.createSpy('close');
    f.componentInstance.tabChanged.subscribe(tab);f.componentInstance.searchChanged.subscribe(search);
    f.componentInstance.choiceSelected.subscribe(choice);f.componentInstance.closeRequested.subscribe(close);
    const root=f.nativeElement as HTMLElement;
    root.querySelectorAll<HTMLButtonElement>('[role=tab]')[2].click();expect(tab).toHaveBeenCalledOnceWith('community');
    const input=root.querySelector<HTMLInputElement>('.inbox-share-filter')!;
    input.value='fut';input.dispatchEvent(new Event('input',{bubbles:true}));await f.whenStable();
    expect(search).toHaveBeenCalledWith('fut');
    root.querySelectorAll<HTMLButtonElement>('.inbox-share-option')[1].click();expect(choice).toHaveBeenCalledOnceWith(group);
    root.querySelector<HTMLButtonElement>('.inbox-share-picker-head button')!.click();expect(close).toHaveBeenCalledTimes(1);
  });
  it('keeps loading, error and empty lists distinct',async()=>{
    const busy=(await render({sharePickerLoading:true})).nativeElement as HTMLElement;
    expect(busy.querySelector('[role=status]')).not.toBeNull();expect(busy.querySelector('.inbox-share-option')).toBeNull();
    const failed=(await render({sharePickerError:true})).nativeElement as HTMLElement;
    expect(failed.querySelector('[role=alert]')).not.toBeNull();
    const empty=(await render({choices:[]})).nativeElement as HTMLElement;
    expect(empty.querySelector('.inbox-share-option')).toBeNull();
  });
});
