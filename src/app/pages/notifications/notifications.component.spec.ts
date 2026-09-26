import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';

import { NotificationsComponent } from './notifications.component';
import { NotificationApiService } from '../../services/notification-api.service';
import { TEST_IMPORTS, TEST_PROVIDERS } from '../../testing/test-providers';

describe('NotificationsComponent', () => {
  let component: NotificationsComponent;
  let fixture: ComponentFixture<NotificationsComponent>;
  let service: jasmine.SpyObj<NotificationApiService>;
  let router: Router;

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
    read: false,
    username: 'fixture-user'
  });

  beforeEach(async () => {
    service = jasmine.createSpyObj<NotificationApiService>(
      'NotificationApiService',
      ['mine', 'markRead', 'delete', 'acceptFriendRequest', 'rejectFriendRequest']
    );
    service.mine.and.returnValue(of([notificationFixture()]));
    service.markRead.and.returnValue(of(void 0));
    service.delete.and.returnValue(of(void 0));
    service.acceptFriendRequest.and.returnValue(of({}));
    service.rejectFriendRequest.and.returnValue(of(void 0));

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
        { provide: NotificationApiService, useValue: service }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(NotificationsComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.returnValue(Promise.resolve(true));
    fixture.detectChanges();
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
