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

  it('should navigate to the related session', () => {
    component.openSession(component.notifications[0]);

    expect(router.navigate).toHaveBeenCalledWith(['/menu/events', 12]);
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
