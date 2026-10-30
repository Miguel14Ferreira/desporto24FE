import { TestBed } from '@angular/core/testing';
import { InboxMessage } from './inbox.model';
import { InboxHistorySearchComponent } from './inbox-history-search.component';
describe('InboxHistorySearchComponent',()=>{
  const hit:InboxMessage={key:'direct:ana',id:25,sender:'Ana',text:'Jogo amanhã',createdAt:'2026-10-26T10:00:00Z'};
  beforeEach(async()=>await TestBed.configureTestingModule({imports:[InboxHistorySearchComponent]}).compileComponents());
  async function render(input:Partial<InboxHistorySearchComponent>={}){
    const fixture=TestBed.createComponent(InboxHistorySearchComponent);
    fixture.componentRef.setInput('dateFormatter',(s:string)=>'Em '+s);
    for(const [k,v] of Object.entries(input))fixture.componentRef.setInput(k,v);
    fixture.detectChanges();await fixture.whenStable();fixture.detectChanges();return fixture;
  }
  it('does not start a history search until a user submits at least two characters',async()=>{
    const f=await render(),root=f.nativeElement as HTMLElement;
    const submit=root.querySelector<HTMLButtonElement>('button[type=submit]')!;
    expect(submit.disabled).toBeTrue();
    const sent=jasmine.createSpy('search');f.componentInstance.searchRequested.subscribe(sent);
    submit.click();expect(sent).not.toHaveBeenCalled();
  });
  it('emits query and search page without making network calls itself',async()=>{
    const f=await render({messageSearchTerm:'Jogo'});
    const q=jasmine.createSpy('q'),s=jasmine.createSpy('search');
    f.componentInstance.termChanged.subscribe(q);f.componentInstance.searchRequested.subscribe(s);
    const root=f.nativeElement as HTMLElement,input=root.querySelector<HTMLInputElement>('input[name=messageQuery]')!;
    input.value='Amanhã';input.dispatchEvent(new Event('input',{bubbles:true}));await f.whenStable();
    expect(q).toHaveBeenCalledWith('Amanhã');
    root.querySelector<HTMLFormElement>('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    expect(s).toHaveBeenCalledWith(0);
  });
  it('shows original result ordering and prevents reply when the composer is locked',async()=>{
    const f=await render({messageSearchResults:[hit],selectedSearchResultId:25,composerAllowed:false});
    const root=f.nativeElement as HTMLElement,card=root.querySelector('.inbox-history-search-result');
    expect(card?.classList.contains('is-selected')).toBeTrue();
    expect(card?.textContent).toContain('Jogo amanhã');
    expect(card?.textContent).toContain('Em 2026-10-26');
    expect(root.querySelector('.inbox-search-result-reply')).toBeNull();
    expect(root.querySelector<HTMLButtonElement>('.inbox-search-result-open')?.getAttribute('aria-pressed')).toBe('true');
  });
  it('emits original history result for locating and replying independently',async()=>{
    const f=await render({messageSearchResults:[hit],composerAllowed:true});
    const locate=jasmine.createSpy('locate'),reply=jasmine.createSpy('reply');
    f.componentInstance.locateRequested.subscribe(locate);f.componentInstance.replyRequested.subscribe(reply);
    const root=f.nativeElement as HTMLElement;
    root.querySelector<HTMLButtonElement>('.inbox-search-result-open')!.click();
    root.querySelector<HTMLButtonElement>('.inbox-search-result-reply')!.click();
    expect(locate).toHaveBeenCalledOnceWith(hit);expect(reply).toHaveBeenCalledOnceWith(hit);
  });
  it('formats GIF search results without changing the original result passed to actions',async()=>{
    const original={...hit,text:'[JYNLO:GIPHY:1]{bad-json}'};
    const f=await render({messageSearchResults:[original],
      previewFormatter: value=>value.startsWith('[JYNLO:GIPHY:1]') ? 'GIF' : value});
    const root=f.nativeElement as HTMLElement;
    const result=root.querySelector('.inbox-history-search-result')!;
    expect(result.textContent).toContain('GIF');
    expect(result.textContent).not.toContain('JYNLO:GIPHY:1');
    expect(result.textContent).not.toContain('{bad-json}');
    const locate=jasmine.createSpy('locate');f.componentInstance.locateRequested.subscribe(locate);
    root.querySelector<HTMLButtonElement>('.inbox-search-result-open')!.click();
    expect(locate).toHaveBeenCalledOnceWith(original);
    expect(original.text).toBe('[JYNLO:GIPHY:1]{bad-json}');
  });
  it('keeps pagination, progress, error and empty results distinct',async()=>{
    const more=await render({messageSearchResults:[hit],messageSearchHasMore:true,messageSearchPage:2});
    const spy=jasmine.createSpy('more');more.componentInstance.searchRequested.subscribe(spy);
    (more.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.inbox-search-more')!.click();
    expect(spy).toHaveBeenCalledOnceWith(3);
    const error=await render({messageSearchError:true});
    expect((error.nativeElement as HTMLElement).querySelector('[role=alert]')).not.toBeNull();
    const empty=await render({messageSearchSearched:true});
    expect((empty.nativeElement as HTMLElement).querySelector('.inbox-history-search-status')).not.toBeNull();
  });
});
