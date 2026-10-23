import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';

import { NotificationsComponent } from './notifications.component';
import { NotificationApiService } from '../../services/notification-api.service';
import { AuthenticationService } from '../../services/authethication.service';
import { TEST_IMPORTS, TEST_PROVIDERS } from '../../testing/test-providers';

describe('NotificationsComponent', () => {
  let component: NotificationsComponent;
  let fixture: ComponentFixture<NotificationsComponent>;
  let service: jasmine.SpyObj<NotificationApiService>;
  let router: Router;
  let authenticationService: jasmine.SpyObj<AuthenticationService>;

  const notificationFixture = () => ({
    id: 4,
    subject: 'Vaga disponível',
    message: 'Foste promovido para participante.',
    greeting: '',
    signature: '',
    createdAt: '2026-09-25T20:00:00Z',
    friendRequest: false,
    updateProfile: false,
    sessionInvite: false,
    normalMessage: false,
    token: null,
    type: 'WAITLIST_PROMOTED',
    sessionId: 12,
    relatedUsername: null,
    read: false,
    username: 'fixture-user'
  });

  const friendRequestFixture = () => ({
    id: 8,
    subject: 'Novo pedido de amizade',
    message: 'ana enviou-te um pedido de amizade.',
    greeting: '',
    signature: '',
    createdAt: '2026-09-25T21:00:00Z',
    friendRequest: true,
    updateProfile: false,
    sessionInvite: false,
    normalMessage: false,
    token: null,
    type: null,
    sessionId: null,
    relatedUsername: null,
    read: false,
    username: 'fixture-user'
  });

  const securityNotificationFixture = () => ({
    id: 12,
    subject: 'Autenticação multifator desativada',
    message: 'A autenticação multifator foi desativada na tua conta DESPORTO24. Se não foste tu, protege imediatamente a tua conta.',
    greeting: 'Cumprimentos,',
    signature: 'DESPORTO24 MANAGEMENT TEAM',
    createdAt: '2026-09-28T19:12:00Z',
    friendRequest: false,
    updateProfile: false,
    sessionInvite: false,
    normalMessage: false,
    token: null,
    type: null,
    sessionId: null,
    relatedUsername: null,
    read: true,
    username: 'fixture-user'
  });

  beforeEach(async () => {
    service = jasmine.createSpyObj<NotificationApiService>(
      'NotificationApiService',
      ['mine', 'markRead', 'delete', 'deleteAll', 'acceptFriendRequest', 'rejectFriendRequest', 'blockOwnAccount']
    );
    service.mine.and.returnValue(of([notificationFixture()]));
    service.markRead.and.returnValue(of(void 0));
    service.delete.and.returnValue(of(void 0));
    service.deleteAll.and.returnValue(of(void 0));
    service.acceptFriendRequest.and.returnValue(of({}));
    service.rejectFriendRequest.and.returnValue(of(void 0));
    service.blockOwnAccount.and.returnValue(of(void 0));
    authenticationService = jasmine.createSpyObj<AuthenticationService>(
      'AuthenticationService',
      ['logOut']
    );

    await TestBed.configureTestingModule({
      declarations: [NotificationsComponent],
      imports: TEST_IMPORTS,
      providers: [
        ...TEST_PROVIDERS,
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({})
            }
          }
        },
        { provide: NotificationApiService, useValue: service },
        { provide: AuthenticationService, useValue: authenticationService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(NotificationsComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.returnValue(Promise.resolve(true));
    fixture.detectChanges();
  });

  it('labels a post-game reminder and links to its session', () => {
    const reminder = {
      ...notificationFixture(),
      type: 'SESSION_POST_GAME_REVIEW',
      subject: 'Como correu o teu jogo?'
    };
    component.selected = reminder;
    fixture.detectChanges();

    expect(component.typeLabel(reminder)).toBe('Pós-jogo');
    const action = Array.from(fixture.nativeElement.querySelectorAll('button'))
      .find((element: any) => element.textContent.includes('Ver pós-jogo')) as HTMLButtonElement;
    expect(action).toBeDefined();
    action.click();
    expect(router.navigate).toHaveBeenCalledWith(['/menu/events', 12]);
  });

  it('should show the community invitation action and open pending invitations', () => {
    const invitation = {
      ...notificationFixture(),
      type: 'COMMUNITY_INVITE',
      subject: 'Convite para a comunidade CNG',
      message: 'Mensagem do servidor',
      relatedUsername: 'TMF14',
      sessionId: null
    };
    component.notifications = [invitation];
    component.selected = invitation;
    fixture.detectChanges();

    const button = Array.from(fixture.nativeElement.querySelectorAll('button'))
      .find((element: any) => element.textContent.includes('Ver convite')) as HTMLButtonElement;
    expect(button).toBeDefined();
    button.click();
    expect(router.navigate).toHaveBeenCalledWith(['/menu/communities']);
  });

  it('should translate invitation content while preserving community and inviter names', () => {
    const previousLanguage = localStorage.getItem('d24-language');
    const invitation = {
      ...notificationFixture(),
      type: 'COMMUNITY_INVITE',
      subject: 'Convite para a comunidade CNG',
      relatedUsername: 'TMF14',
      sessionId: null
    };
    try {
      localStorage.setItem('d24-language', 'pt');
      expect(component.typeLabel(invitation)).toBe('Convite de comunidade');
      expect(component.notificationSubject(invitation)).toBe('Convite para a comunidade CNG');
      expect(component.notificationMessage(invitation)).toBe(
        '@TMF14 convidou-te para a comunidade CNG. Abre o convite para aceitar ou rejeitar.');
      localStorage.setItem('d24-language', 'en');
      expect(component.typeLabel(invitation)).toBe('Community invitation');
      expect(component.notificationSubject(invitation)).toBe('Invitation to the CNG community');
      expect(component.notificationMessage(invitation)).toBe(
        '@TMF14 invited you to the CNG community. Open the invitation to accept or reject.');
      expect(component.notificationMessage(notificationFixture())).toBe('Foste promovido para participante.');
      component.openCommunityInvite(notificationFixture());
      expect(router.navigate).not.toHaveBeenCalled();
    } finally {
      if (previousLanguage === null) {
        localStorage.removeItem('d24-language');
      } else {
        localStorage.setItem('d24-language', previousLanguage);
      }
    }
  });

  it('opens chat notifications directly in the unified inbox', () => {
    const notice = { ...notificationFixture(), type: 'CHAT_MESSAGE', relatedUsername: 'ana' };
    component.openChat(notice);
    expect(router.navigate).toHaveBeenCalledWith(['/menu/messages'],
      { queryParams: { kind: 'direct', id: 'ana' } });
    (router.navigate as jasmine.Spy).calls.reset();
    component.openChat({ ...notice, relatedUsername: null });
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('opens a new join request notification directly in member management', () => {
    const joinRequest = {
      ...notificationFixture(), id: 91, type: 'COMMUNITY_JOIN_REQUEST', communityId: 42,
      subject: 'Novo pedido para a comunidade Futsal', relatedUsername: 'ana', sessionId: null
    };
    component.selected = joinRequest;
    fixture.detectChanges();
    const button = Array.from(fixture.nativeElement.querySelectorAll('button'))
      .find((element: any) => element.textContent.includes('Gerir pedidos de adesão')) as HTMLButtonElement;
    expect(button).toBeDefined();
    expect(component.typeLabel(joinRequest)).toBe('Pedido de adesão');
    expect(component.notificationMessage(joinRequest)).toContain('@ana');
    button.click();
    expect(router.navigate).toHaveBeenCalledWith(
      ['/menu/communities', 42], { queryParams: { tab: 'members' } }
    );
  });

  it('opens an accepted community without giving additional permissions', () => {
    const approved = {
      ...notificationFixture(), id: 92, type: 'COMMUNITY_JOIN_ACCEPTED', communityId: 42,
      subject: 'Pedido aceite na comunidade Futsal', sessionId: null
    };
    component.selected = approved;
    fixture.detectChanges();
    expect(component.typeLabel(approved)).toBe('Adesão aprovada');
    const button = Array.from(fixture.nativeElement.querySelectorAll('button'))
      .find((element: any) => element.textContent.includes('Ver comunidade')) as HTMLButtonElement;
    expect(button).toBeDefined();
    button.click();
    expect(router.navigate).toHaveBeenCalledWith(['/menu/communities', 42]);
  });

  it('handles refused requests without granting access', () => {
    const refused = {
      ...notificationFixture(), id: 93, type: 'COMMUNITY_JOIN_REJECTED', communityId: 42,
      subject: 'Pedido recusado na comunidade Futsal', sessionId: null
    };
    component.selected = refused;
    fixture.detectChanges();
    expect(component.typeLabel(refused)).toBe('Adesão recusada');
    component.openJoinCommunity(refused);
    expect(router.navigate).toHaveBeenCalledWith(['/menu/communities', 42]);
  });

  it('ignores join notifications without safe community IDs', () => {
    for (const communityId of [null, undefined, 0, -2, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      component.openJoinCommunity({
        ...notificationFixture(), type: 'COMMUNITY_JOIN_REQUEST', communityId
      });
    }
    component.openJoinCommunity({ ...notificationFixture(), type: 'CHAT_MESSAGE', communityId: 42 });
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('shows new membership notification content in both languages', () => {
    const previousLanguage = localStorage.getItem('d24-language');
    const pending = { ...notificationFixture(), type: 'COMMUNITY_JOIN_REQUEST',
      subject: 'Novo pedido para a comunidade Futsal', relatedUsername: 'ana' };
    const accepted = { ...notificationFixture(), type: 'COMMUNITY_JOIN_ACCEPTED',
      subject: 'Pedido aceite na comunidade Futsal' };
    try {
      localStorage.setItem('d24-language', 'pt');
      expect(component.notificationSubject(pending)).toBe('Novo pedido: Futsal');
      expect(component.notificationSubject(accepted)).toBe('Pedido aprovado: Futsal');
      localStorage.setItem('d24-language', 'en');
      expect(component.typeLabel(pending)).toBe('Membership request');
      expect(component.notificationSubject(pending)).toBe('New request: Futsal');
      expect(component.notificationMessage(accepted)).toContain('was approved');
    } finally {
      if (previousLanguage === null) localStorage.removeItem('d24-language');
      else localStorage.setItem('d24-language', previousLanguage);
    }
  });

  it('should create and load notifications', () => {
    expect(component).toBeTruthy();
    expect(component.notifications.length).toBe(1);
    expect(component.unreadCount).toBe(1);
  });

  it('should mark an unread notification as read when opened', () => {
    component.openNotification(component.notifications[0]);

    expect(service.markRead).toHaveBeenCalledWith(4);
    expect(component.notifications[0].read).toBeTrue();
  });

  it('should delete a notification by id', () => {
    component.deleteNotification(component.notifications[0]);

    expect(service.delete).toHaveBeenCalledWith(4);
    expect(component.notifications.length).toBe(0);
  });

  it('should clear all notifications after confirmation', () => {
    component.notifications = [notificationFixture(), friendRequestFixture()];
    component.selected = component.notifications[0];

    component.requestClearAll();
    expect(component.clearAllConfirming).toBeTrue();

    component.clearAllNotifications();

    expect(service.deleteAll).toHaveBeenCalled();
    expect(component.notifications).toEqual([]);
    expect(component.selected).toBeUndefined();
    expect(component.clearAllConfirming).toBeFalse();
    expect(router.navigate).toHaveBeenCalledWith(['/menu/notifications']);
  });

  it('opens a promoted waitlist notification at the current membership status', () => {
    const promoted = component.notifications[0];
    component.selected = promoted;
    fixture.detectChanges();

    const action = Array.from(fixture.nativeElement.querySelectorAll('button'))
      .find((element: any) => element.textContent.includes('Ver estado da inscrição')) as HTMLButtonElement;
    expect(action).toBeDefined();
    action.click();

    expect(router.navigate).toHaveBeenCalledWith(['/menu/events', 12], {
      queryParams: { membership: '1' }
    });
  });

  it('keeps ordinary session notifications pointing to session details', () => {
    component.openSession({ ...notificationFixture(), type: 'SESSION_CANCELLED' });
    expect(router.navigate).toHaveBeenCalledWith(['/menu/events', 12]);
  });

  it('does not navigate from a promotion notification with no session ID', () => {
    (router.navigate as jasmine.Spy).calls.reset();
    component.openSession({ ...notificationFixture(), sessionId: null });
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('should accept a friend request without exposing its token', () => {
    const friendRequest = friendRequestFixture();
    component.notifications = [friendRequest];
    component.selected = friendRequest;

    component.acceptFriendRequest(friendRequest);

    expect(service.acceptFriendRequest).toHaveBeenCalledWith(8);
    expect(component.notifications.length).toBe(0);
    expect(component.actionSuccess).toContain('aceite');
  });

  it('should offer account protection for suspicious security notifications', () => {
    const securityNotification = securityNotificationFixture();

    expect(component.canProtectAccount(securityNotification)).toBeTrue();
  });

  it('should offer account protection on profile update notifications', () => {
    const profileUpdate = {
      ...securityNotificationFixture(),
      subject: 'Perfil atualizado',
      message: 'Foram atualizados dados do teu perfil.',
      updateProfile: true
    };

    expect(component.canProtectAccount(profileUpdate)).toBeTrue();
  });

  it('should offer account protection on password change notifications', () => {
    const passwordChange = {
      ...securityNotificationFixture(),
      subject: 'Palavra-passe alterada',
      message: 'A tua palavra-passe foi alterada.',
      updateProfile: true
    };

    expect(component.canProtectAccount(passwordChange)).toBeTrue();
  });

  it('should not expose account blocking for unrelated notifications', () => {
    expect(component.canProtectAccount(notificationFixture())).toBeFalse();
  });

  it('should block the account and clear the local session after confirmation', () => {
    const securityNotification = securityNotificationFixture();
    component.selected = securityNotification;

    component.blockAccountAccess();

    expect(service.blockOwnAccount).toHaveBeenCalled();
    expect(authenticationService.logOut).toHaveBeenCalled();
  });

  it('should reject a friend request through the authenticated endpoint', () => {
    const friendRequest = friendRequestFixture();
    component.notifications = [friendRequest];
    component.selected = friendRequest;

    component.rejectFriendRequest(friendRequest);

    expect(service.rejectFriendRequest).toHaveBeenCalledWith(8);
    expect(component.notifications.length).toBe(0);
    expect(component.actionSuccess).toContain('rejeitado');
  });
});
