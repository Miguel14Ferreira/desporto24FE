import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';

import { MenuComponent } from './menu.component';
import { AuthenticationService } from '../../services/authethication.service';
import { MyProfileService } from '../../services/my-profile.service';
import { NotificationApiService } from '../../services/notification-api.service';
import { TEST_IMPORTS, TEST_PROVIDERS } from '../../testing/test-providers';

describe('MenuComponent', () => {
  let component: MenuComponent;
  let fixture: ComponentFixture<MenuComponent>;
  let authenticationService: jasmine.SpyObj<AuthenticationService>;
  let profileService: jasmine.SpyObj<MyProfileService>;
  let notificationService: jasmine.SpyObj<NotificationApiService>;

  beforeEach(async () => {
    authenticationService = jasmine.createSpyObj<AuthenticationService>(
      'AuthenticationService',
      ['terminarSessao', 'logOut']
    );
    authenticationService.terminarSessao.and.returnValue(of(void 0));

    profileService = jasmine.createSpyObj<MyProfileService>('MyProfileService', ['get']);
    profileService.get.and.returnValue(of({
      userId: 'u1',
      username: 'miguel',
      fullName: 'Miguel Ferreira',
      dateOfBirth: null,
      address: null,
      country: 'Portugal',
      location: 'Lisboa',
      postalCode: null,
      indicativePhone: '351',
      phone: '912345678',
      gender: null,
      email: 'miguel@example.com',
      favoriteSports: 'Padel',
      mfa: true,
      profilePicUrl: null,
      joinDateDisplay: null,
      lastLoginDateDisplay: null
    }));

    notificationService = jasmine.createSpyObj<NotificationApiService>(
      'NotificationApiService',
      ['mine']
    );
    notificationService.mine.and.returnValue(of([
      {
        id: 1,
        subject: 'Nova mensagem',
        message: 'Teste',
        greeting: '',
        signature: '',
        createdAt: '2026-09-25T20:00:00Z',
        friendRequest: false,
        updateProfile: false,
        sessionInvite: false,
        normalMessage: true,
        token: null,
        type: null,
        sessionId: null,
        read: false,
        username: 'miguel'
      }
    ]));

    await TestBed.configureTestingModule({
      declarations: [MenuComponent],
      imports: TEST_IMPORTS,
      providers: [
        ...TEST_PROVIDERS,
        { provide: AuthenticationService, useValue: authenticationService },
        { provide: MyProfileService, useValue: profileService },
        { provide: NotificationApiService, useValue: notificationService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(MenuComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and load dashboard data', () => {
    expect(component).toBeTruthy();
    expect(profileService.get).toHaveBeenCalled();
    expect(notificationService.mine).toHaveBeenCalled();
    expect(component.profile?.username).toBe('miguel');
    expect(component.unreadNotifications).toBe(1);
  });

  it('should terminate the remote session and clear local authentication', () => {
    component.logout();

    expect(authenticationService.terminarSessao).toHaveBeenCalled();
    expect(authenticationService.logOut).toHaveBeenCalled();
  });
});
