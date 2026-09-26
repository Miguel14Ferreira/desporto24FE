import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';

import { DirectChatComponent } from './direct-chat.component';
import { DirectChatService } from '../../services/direct-chat.service';
import { CommunityService } from '../../services/community.service';
import { TEST_IMPORTS, TEST_PROVIDERS } from '../../testing/test-providers';

describe('DirectChatComponent', () => {
  let component: DirectChatComponent;
  let fixture: ComponentFixture<DirectChatComponent>;
  let service: jasmine.SpyObj<DirectChatService>;
  let communityService: jasmine.SpyObj<CommunityService>;

  beforeEach(async () => {
    service = jasmine.createSpyObj<DirectChatService>(
      'DirectChatService',
      ['history', 'send', 'info']
    );
    service.history.and.returnValue(of([]));
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
    expect(service.history).toHaveBeenCalledWith('ana');
    expect(service.info).toHaveBeenCalledWith('ana');
  });

  it('should send a direct message and append it locally', () => {
    component.messageBody = '  Olá!  ';

    component.sendMessage();

    expect(service.send).toHaveBeenCalledWith('ana', 'Olá!');
    expect(component.messages.length).toBe(1);
    expect(component.messageBody).toBe('');
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
