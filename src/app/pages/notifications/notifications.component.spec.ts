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

  const notification = {
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
  };

  beforeEach(async () => {
    service = jasmine.createSpyObj<NotificationApiService>(
      'NotificationApiService',
      ['mine', 'markRead', 'delete', 'acceptFriendRequest']
    );
    service.mine.and.returnValue(of([notification]));
    service.markRead.and.returnValue(of(void 0));
    service.delete.and.returnValue(of(void 0));
    service.acceptFriendRequest.and.returnValue(of({}));

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
});
