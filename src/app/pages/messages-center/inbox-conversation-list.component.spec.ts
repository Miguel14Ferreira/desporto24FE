import { TestBed } from '@angular/core/testing';
import { InboxConversationListComponent, InboxListFormatters } from './inbox-conversation-list.component';
import { InboxConversation } from './inbox.model';

describe('InboxConversationListComponent', () => {
  const direct:InboxConversation={
    key:'direct:ana',id:'ana',kind:'direct',title:'Ana Silva',subtitle:'Amiga',
    latestText:'Olá!',latestAt:'2026-10-26T11:00:00Z',newThisVisit:0,unreadCount:3
  };
  const community:InboxConversation={
    key:'community:4',id:4,kind:'community',title:'Futebol',subtitle:'Comunidade',
    newThisVisit:0,unreadCount:0
  };
  const formatters:InboxListFormatters={
    date: v=>'full '+v,time: _=>'11:00',kind: kind=>'inbox.'+kind,
    preview:v=>'preview '+v,unread:c=>String(c.unreadCount??c.newThisVisit)
  };
  beforeEach(async()=>{
    await TestBed.configureTestingModule({imports:[InboxConversationListComponent]}).compileComponents();
  });
  function render(conversations:InboxConversation[],selectedKey:string|null=null) {
    const fixture=TestBed.createComponent(InboxConversationListComponent);
    fixture.componentRef.setInput('conversations',conversations);
    fixture.componentRef.setInput('selectedKey',selectedKey);
    fixture.componentRef.setInput('formatters',formatters);
    fixture.detectChanges();
    return fixture;
  }
  it('preserves ordering, compact timestamp, preview, unread count and accessibility',()=>{
    const root=render([direct,community],'direct:ana').nativeElement as HTMLElement;
    const rows=root.querySelectorAll<HTMLButtonElement>('.inbox-entry');
    expect(rows.length).toBe(2);
    expect(rows[0].classList.contains('is-selected')).toBeTrue();
    expect(rows[0].getAttribute('aria-pressed')).toBe('true');
    expect(rows[1].getAttribute('aria-pressed')).toBe('false');
    expect(rows[0].textContent).toContain('Ana Silva');
    expect(rows[0].textContent).toContain('preview Olá!');
    expect(rows[0].querySelector('small')?.textContent).toContain('11:00');
    expect(rows[0].querySelector('.inbox-unread')?.textContent).toContain('3');
    expect(rows[1].querySelector('.inbox-unread')).toBeNull();
    expect(rows[1].textContent).toContain('Futebol');
  });
  it('emits the original conversation unchanged without navigating or marking read',()=>{
    const f=render([direct,community]);
    const chosen=jasmine.createSpy('chosen');
    f.componentInstance.conversationSelected.subscribe(chosen);
    (f.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('.inbox-entry')[1].click();
    expect(chosen).toHaveBeenCalledOnceWith(community);
  });
  it('keeps conversation-kind avatars and fallback text in each row',()=>{
    const root=render([direct,community,{...community,key:'session:7',id:7,kind:'session',title:'Futsal'}]).nativeElement as HTMLElement;
    expect(root.querySelectorAll('.inbox-avatar--community').length).toBe(1);
    expect(root.querySelectorAll('.inbox-avatar--session').length).toBe(1);
    expect(root.querySelectorAll('.inbox-entry').length).toBe(3);
    expect(root.querySelector('.inbox-entry:nth-child(2) .inbox-entry-snippet')).not.toBeNull();
  });
  it('never manufactures conversations or selectable rows when empty',()=>{
    const root=render([]).nativeElement as HTMLElement;
    expect(root.querySelector('.inbox-entries')).not.toBeNull();
    expect(root.querySelectorAll('.inbox-entry').length).toBe(0);
  });
});
