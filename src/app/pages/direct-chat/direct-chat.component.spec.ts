import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';

import { DirectChatComponent } from './direct-chat.component';
import { DirectChatService } from '../../services/direct-chat.service';
import { DirectChatRealtimeService } from '../../services/direct-chat-realtime.service';
import { CommunityService } from '../../services/community.service';
import { TEST_IMPORTS, TEST_PROVIDERS } from '../../testing/test-providers';

describe('DirectChatComponent', () => {
  let component: DirectChatComponent;
  let fixture: ComponentFixture<DirectChatComponent>;
  let service: jasmine.SpyObj<DirectChatService>;
  let communityService: jasmine.SpyObj<CommunityService>;
  let messages: Subject<import('../model/direct-chat').DirectChatMessage>;
  let connection: Subject<boolean>;

  beforeEach(async () => {
    messages = new Subject();
    connection = new Subject();
    service = jasmine.createSpyObj<DirectChatService>(
      'DirectChatService',
      ['recentHistory', 'send', 'info']
    );
    service.recentHistory.and.returnValue(of({ content: [], last: true }));
    service.info.and.returnValue(of({
      chatBlocked: false,
      whoBlocked: null
    }));
    service.send.and.returnValue(of({
      id: 1,
      username1: 'fixture-user',
      username2: 'ana',
      text: 'Olá!',
      dataDisplay: null,
      date: '2026-09-26T00:00:00Z'
    }));

    communityService = jasmine.createSpyObj<CommunityService>(
      'CommunityService',
      ['blockFriend', 'unblockFriend']
    );
    communityService.blockFriend.and.returnValue(of({}));
    communityService.unblockFriend.and.returnValue(of({}));

    await TestBed.configureTestingModule({
      declarations: [DirectChatComponent],
      imports: TEST_IMPORTS,
      providers: [
        ...TEST_PROVIDERS,
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ username: 'ana' })
            }
          }
        },
        { provide: DirectChatService, useValue: service },
        {
          provide: DirectChatRealtimeService,
          useValue: {
            connect: jasmine.createSpy('connect'),
            messages$: messages.asObservable(),
            connected$: connection.asObservable()
          }
        },
        { provide: CommunityService, useValue: communityService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DirectChatComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and load chat history', () => {
    expect(component).toBeTruthy();
    expect(component.recipientUsername).toBe('ana');
    expect(service.recentHistory).toHaveBeenCalledWith('ana');
    expect(service.info).toHaveBeenCalledWith('ana');
  });

  it('should send a direct message and append it locally', () => {
    component.messageBody = '  Olá!  ';

    component.sendMessage();

    expect(service.send).toHaveBeenCalledWith('ana', 'Olá!');
    expect(component.messages.length).toBe(1);
    expect(component.messageBody).toBe('');
  });

  it('shows the live connection and reconnecting state without claiming read receipts', () => {
    expect(component.realtimeConnected).toBeFalse();
    connection.next(true);
    expect(component.realtimeConnected).toBeTrue();
    expect(component.realtimeEverConnected).toBeTrue();
    connection.next(false);
    fixture.detectChanges();
    expect(component.realtimeConnected).toBeFalse();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('A restabelecer ligação');
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Lida');
  });

  it('does not overwrite a newly received WebSocket message on refresh', () => {
    component.currentUsername = 'fixture-user';
    const incoming = {
      id: 47, username1: 'ana', username2: 'fixture-user',
      text: 'Mensagem em tempo real', date: new Date().toISOString(), dataDisplay: null
    };
    messages.next(incoming);
    service.recentHistory.and.returnValue(of({ content: [], last: true }));
    component.load();
    expect(component.messages.map(m => m.id)).toEqual([47]);
    messages.next(incoming);
    expect(component.messages.length).toBe(1);
  });

  it('blocks accidental duplicate POST on uncertain delivery, preserving unsent text', () => {
    component.currentUsername = 'fixture-user';
    component.messageBody = 'Teste de rede';
    service.send.and.returnValue(throwError(() => new HttpErrorResponse({ status: 0 })));
    service.recentHistory.and.returnValue(of({ content: [], last: true }));
    component.sendMessage();

    expect(service.send).toHaveBeenCalledTimes(1);
    expect(component.deliveryUncertain).toBeTrue();
    expect(component.messageBody).toBe('Teste de rede');
    component.sendMessage();
    expect(service.send).toHaveBeenCalledTimes(1);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('.delivery-warning')).not.toBeNull();
    component.resumeAfterUncertainSend();
    expect(component.deliveryUncertain).toBeFalse();
    expect(component.messageBody).toBe('Teste de rede');
  });

  it('confirms a timed-out message from server history without sending again', () => {
    component.currentUsername = 'fixture-user';
    component.messageBody = 'Já está confirmado';
    const delivered = {
      id: 55, username1: 'fixture-user', username2: 'ana',
      text: 'Já está confirmado', date: new Date().toISOString(), dataDisplay: null
    };
    service.send.and.returnValue(throwError(() => new HttpErrorResponse({ status: 503 })));
    service.recentHistory.and.returnValue(of({ content: [delivered], last: true }));
    component.sendMessage();

    expect(component.deliveryUncertain).toBeFalse();
    expect(component.messageBody).toBe('');
    expect(component.messages.map(message => message.id)).toContain(55);
    expect(service.send).toHaveBeenCalledTimes(1);
    expect(component.actionSuccess).toContain('confirmada');
  });

  it('ignores an old identical message when verifying an uncertain send', () => {
    component.currentUsername = 'fixture-user';
    const old = {
      id: 12, username1: 'fixture-user', username2: 'ana',
      text: 'Mesmo texto', date: new Date().toISOString(), dataDisplay: null
    };
    component.messages = [old];
    component.messageBody = 'Mesmo texto';
    service.send.and.returnValue(throwError(() => new HttpErrorResponse({ status: 408 })));
    service.recentHistory.and.returnValue(of({ content: [old], last: true }));
    component.sendMessage();
    expect(component.deliveryUncertain).toBeTrue();
    expect(component.messageBody).toBe('Mesmo texto');
    expect(service.send).toHaveBeenCalledTimes(1);
  });

  it('does not send Enter while an IME composition is in progress', () => {
    component.messageBody = 'texto';
    const event = new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, cancelable: true });
    component.onEnter(event);
    expect(service.send).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBeFalse();
  });

  it('should not send when chat is blocked', () => {
    component.chatInfo = {
      chatBlocked: true,
      whoBlocked: 'ana'
    };
    component.messageBody = 'Olá';

    component.sendMessage();

    expect(service.send).not.toHaveBeenCalled();
  });

  it('should block the direct chat', () => {
    component.currentUsername = 'fixture-user';
    component.chatInfo = { chatBlocked: false, whoBlocked: null };

    component.toggleChatBlock();

    expect(communityService.blockFriend).toHaveBeenCalledWith('ana');
    expect(component.chatInfo?.chatBlocked).toBeTrue();
  });

  it('should unblock a chat blocked by the current user', () => {
    component.currentUsername = 'fixture-user';
    component.chatInfo = {
      chatBlocked: true,
      whoBlocked: 'fixture-user'
    };

    component.toggleChatBlock();

    expect(communityService.unblockFriend).toHaveBeenCalledWith('ana');
    expect(component.chatInfo?.chatBlocked).toBeFalse();
  });
});
