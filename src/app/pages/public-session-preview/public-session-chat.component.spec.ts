import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { RouterTestingModule } from '@angular/router/testing';
import { NEVER, Subject, of, throwError } from 'rxjs';
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

  it('stops checking after a slow server and provides a working retry', fakeAsync(() => {
    page.authenticated = true;
    let requests = 0;
    http.get.and.callFake(() => ++requests === 1 ? NEVER as any : of([sample]) as any);
    fixture.detectChanges();
    expect(page.loading).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain('A verificar acesso ao chat');
    tick(10001);
    fixture.detectChanges();
    expect(page.loading).toBeFalse();
    expect(page.allowed).toBeFalse();
    const error = fixture.nativeElement.querySelector('.invite-chat-error') as HTMLElement;
    expect(page.readError).toBe('publicSession.chatLoadError');
    expect(error).withContext('Chat state: '+ JSON.stringify({
      loading: page.loading, readError: page.readError, loginRequired: page.loginRequired,
      open: page.chatOpen, html: fixture.nativeElement.textContent.slice(0,500)
    })).not.toBeNull();
    expect(error.textContent).toContain('Não foi possível atualizar o chat');
    const retry = fixture.nativeElement.querySelector('.invite-chat-retry') as HTMLButtonElement;
    expect(retry.disabled).toBeFalse();
    retry.click();
    fixture.detectChanges();
    expect(http.get).toHaveBeenCalledTimes(2);
    expect(page.allowed).toBeTrue();
    expect(fixture.nativeElement.textContent).toContain('Até logo!');
  }));

  it('shows sign-in on expired auth instead of claiming an enrolled player is absent', () => {
    page.authenticated = true;
    page.returnUrl = '/sessions/42?guest=token';
    http.get.and.returnValue(throwError(() => new HttpErrorResponse({status: 401})));
    fixture.detectChanges();
    expect(page.loading).toBeFalse();
    expect(page.loginRequired).toBeTrue();
    expect(page.allowed).toBeFalse();
    const signIn = fixture.nativeElement.querySelector('.invite-chat-join') as HTMLAnchorElement;
    expect(signIn).not.toBeNull();
    expect(signIn.textContent).toContain('Iniciar sessão');
    expect(signIn.getAttribute('href')).toContain('returnUrl=');
    expect(fixture.nativeElement.querySelector('.invite-chat-messages')).toBeNull();
  });

  it('does not grant chat access for a rejected user until the API approves retry', () => {
    page.authenticated = true;
    http.get.and.returnValues(
      throwError(() => new HttpErrorResponse({status: 403})), of([sample]) as any
    );
    fixture.detectChanges();
    expect(page.allowed).toBeFalse();
    expect(fixture.nativeElement.querySelector('.invite-chat-messages')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Confirma a tua presença');
    (fixture.nativeElement.querySelector('.invite-chat-retry') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(page.allowed).toBeTrue();
    expect(page.messages).toEqual([sample]);
  });

  it('keeps authorised messages visible when a background refresh fails', () => {
    page.authenticated = true;
    http.get.and.returnValues(
      of([sample]) as any, throwError(() => new HttpErrorResponse({status: 503})),
      of([sample]) as any
    );
    fixture.detectChanges();
    page.loadMessages(false);
    fixture.detectChanges();
    expect(page.allowed).toBeTrue();
    expect(page.messages).toEqual([sample]);
    expect(page.readError).toBe('publicSession.chatLoadError');
    expect(fixture.nativeElement.querySelector('.invite-chat-error'))
      .withContext('Chat state: ' + JSON.stringify({
        readError: page.readError, allowed: page.allowed,
        html: fixture.nativeElement.textContent.slice(0,500)
      })).not.toBeNull();
    page.retryChatAccess();
    fixture.detectChanges();
    expect(page.readError).toBe('');
    expect(page.messages).toEqual([sample]);
  });

  it('cancels a pending access check when the invitation session changes', () => {
    page.authenticated = true;
    http.get.and.returnValues(NEVER as any, of([]) as any);
    fixture.detectChanges();
    expect(page.loading).toBeTrue();
    page.sessionId = 43;
    page.ngOnChanges({});
    fixture.detectChanges();
    expect(http.get).toHaveBeenCalledTimes(2);
    expect(http.get.calls.mostRecent().args[0]).toContain('/sessions/43/messages');
    expect(page.allowed).toBeTrue();
    expect(page.loading).toBeFalse();
    expect(page.messages).toEqual([]);
  });

  it('does not read with an invitation link or an unapproved guest receipt', () => {
    page.guestConfirmed = false;
    page.guestReceipt = 'a'.repeat(43);
    fixture.detectChanges();
    expect(http.get).not.toHaveBeenCalled();
    expect(http.post).not.toHaveBeenCalled();
    expect(page.allowed).toBeFalse();
  });

  it('reads and posts as confirmed guest using only private JSON receipt', () => {
    const receipt = 'b'.repeat(43);
    page.guestConfirmed = true;
    page.guestReceipt = receipt;
    const guestMessage = {...sample, senderUsername:'André (Borralho)', senderGuest:true};
    http.post.and.returnValues(of([guestMessage]) as any,
      of({...guestMessage,id:6,body:'Estou a chegar'}) as any);
    fixture.detectChanges();
    expect(http.get).not.toHaveBeenCalled();
    expect(http.post).toHaveBeenCalledWith(
      jasmine.stringMatching(/\/api\/sessions\/42\/messages\/guest-chat\/read$/),
      {receipt});
    expect(page.allowed).toBeTrue();
    expect(realtime.connect).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('André (Borralho)');
    expect(fixture.nativeElement.textContent).not.toContain('@André');
    page.messageText='Estou a chegar';
    page.sendMessage();
    expect(http.post).toHaveBeenCalledWith(
      jasmine.stringMatching(/\/api\/sessions\/42\/messages\/guest-chat\/send$/),
      {receipt,body:'Estou a chegar'});
    expect(page.messages.length).toBe(2);
  });

  it('clears guest messages immediately when receipt approval is revoked', () => {
    page.guestConfirmed=true;
    page.guestReceipt='c'.repeat(43);
    http.post.and.returnValue(of([sample]) as any);
    fixture.detectChanges();
    expect(page.allowed).toBeTrue();
    page.guestConfirmed=false;
    page.ngOnChanges({});
    fixture.detectChanges();
    expect(page.allowed).toBeFalse();
    expect(page.messages).toEqual([]);
    expect(fixture.nativeElement.querySelector('textarea')).toBeNull();
    page.messageText='Não enviar';
    page.sendMessage();
    expect(http.post).toHaveBeenCalledTimes(1);
  });

  it('guest receipt of another session is never accepted by frontend as authorization', () => {
    page.guestConfirmed=true;
    page.guestReceipt='d'.repeat(43);
    http.post.and.returnValue(throwError(() => new HttpErrorResponse({status:403})));
    fixture.detectChanges();
    expect(page.allowed).toBeFalse();
    expect(page.messages).toEqual([]);
    expect(realtime.connect).not.toHaveBeenCalled();
  });
});
