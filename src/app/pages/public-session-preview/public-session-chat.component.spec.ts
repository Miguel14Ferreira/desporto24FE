import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { RouterTestingModule } from '@angular/router/testing';
import { Subject, of, throwError } from 'rxjs';
import { PublicSessionChatComponent } from './public-session-chat.component';
import { DirectChatRealtimeService } from '../../services/direct-chat-realtime.service';
import { SessionMessage } from '../model/session-message';

describe('Public invitation session chat access', () => {
  let fixture: ComponentFixture<PublicSessionChatComponent>;
  let page: PublicSessionChatComponent;
  let http: jasmine.SpyObj<HttpClient>;
  let realtime: {sessionMessages$: Subject<SessionMessage>; connect: jasmine.Spy};

  const sample: SessionMessage = {
    id: 5, sessionId: 42, senderUsername: 'player1',
    body: 'Até logo!', createdAt: new Date().toISOString()
  };

  beforeEach(async () => {
    http = jasmine.createSpyObj<HttpClient>('HttpClient',['get','post']);
    realtime = {sessionMessages$:new Subject(),connect:jasmine.createSpy('connect')};
    await TestBed.configureTestingModule({
      imports:[PublicSessionChatComponent,RouterTestingModule],
      providers:[
        {provide:HttpClient,useValue:http},
        {provide:DirectChatRealtimeService,useValue:realtime}
      ]
    }).compileComponents();
    fixture=TestBed.createComponent(PublicSessionChatComponent);
    page=fixture.componentInstance;
    page.sessionId=42;
    page.startsAt=new Date(Date.now()+3600000).toISOString();
  });
  afterEach(() => fixture.destroy());

  it('does not request chat or expose messages to anonymous invite holders', () => {
    page.authenticated=false;
    page.guestConfirmed=true;
    fixture.detectChanges();
    expect(http.get).not.toHaveBeenCalled();
    expect(http.post).not.toHaveBeenCalled();
    expect(page.allowed).toBeFalse();
    expect(fixture.nativeElement.textContent).toContain('A tua presença está confirmada');
    expect(fixture.nativeElement.querySelector('textarea')).toBeNull();
  });

  it('does not grant access merely because a logged-in user has the invitation', () => {
    page.authenticated=true;
    http.get.and.returnValue(throwError(() => new HttpErrorResponse({status:403})));
    fixture.detectChanges();
    expect(http.get).toHaveBeenCalledWith(jasmine.stringMatching(/\/api\/sessions\/42\/messages$/));
    expect(page.allowed).toBeFalse();
    expect(fixture.nativeElement.querySelector('textarea')).toBeNull();
    expect(realtime.connect).not.toHaveBeenCalled();
  });

  it('shows chat and sends via existing authenticated endpoint for a confirmed player', () => {
    page.authenticated=true;
    http.get.and.returnValue(of([sample]) as any);
    http.post.and.returnValue(of({...sample,id:6,body:'Vou chegar cedo'}) as any);
    fixture.detectChanges();
    expect(page.allowed).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain('Até logo!');
    expect(realtime.connect).toHaveBeenCalled();
    page.messageText='Vou chegar cedo';
    page.sendMessage();
    expect(http.post).toHaveBeenCalledWith(
      jasmine.stringMatching(/\/api\/sessions\/42\/messages$/),{body:'Vou chegar cedo'});
    expect(page.messageText).toBe('');
    expect(page.messages.length).toBe(2);
    realtime.sessionMessages$.next({...sample,id:7,body:'Até já'});
    expect(page.messages.length).toBe(3);
    realtime.sessionMessages$.next({...sample,id:7,body:'Até já'});
    expect(page.messages.length).toBe(3);
  });

  it('hides the chat immediately after attendance access is revoked', async () => {
    page.authenticated=true;
    http.get.and.returnValues(of([sample]) as any,
      throwError(() => new HttpErrorResponse({status:403})));
    fixture.detectChanges();
    expect(page.allowed).toBeTrue();
    page.loadMessages();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(page.allowed).toBeFalse();
    expect(page.messages).toEqual([]);
    expect(fixture.nativeElement.querySelector('.invite-chat-messages')).toBeNull();
  });

  it('never sends after kickoff, or on an anonymous confirmed guest receipt', () => {
    page.authenticated=true;
    page.startsAt=new Date(Date.now()-60000).toISOString();
    fixture.detectChanges();
    expect(http.get).not.toHaveBeenCalled();
    page.messageText='Mensagem tardia';
    page.sendMessage();
    expect(http.post).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('antes do início do jogo');
  });

  it('treats HTTP failure as uncertain rather than retrying a POST or losing draft', () => {
    page.authenticated=true;
    http.get.and.returnValue(of([]) as any);
    http.post.and.returnValue(throwError(() => new HttpErrorResponse({status:0})));
    fixture.detectChanges();
    page.messageText='A caminho';
    page.sendMessage();
    expect(http.post).toHaveBeenCalledTimes(1);
    expect(page.messageText).toBe('A caminho');
    expect(page.sendError).toBe('publicSession.chatSendError');
  });
});
