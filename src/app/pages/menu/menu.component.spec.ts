import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';

import { MenuComponent } from './menu.component';
import { I18nService, preloadEnglishTranslations } from '../../i18n/i18n.service';
import { AuthenticationService } from '../../services/authethication.service';
import { MyProfileService } from '../../services/my-profile.service';
import { NotificationApiService } from '../../services/notification-api.service';
import { AdminAccessService } from '../../services/admin-access.service';
import { TEST_IMPORTS, TEST_PROVIDERS } from '../../testing/test-providers';

describe('MenuComponent', () => {
  let component: MenuComponent;
  let fixture: ComponentFixture<MenuComponent>;
  let authenticationService: jasmine.SpyObj<AuthenticationService>;
  let profileService: jasmine.SpyObj<MyProfileService>;
  let notificationService: jasmine.SpyObj<NotificationApiService>;
  let adminAccessService: jasmine.SpyObj<AdminAccessService>;

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
      nickname: null,
      bio: null,
      skillLevel: null,
      availability: null,
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
        relatedUsername: null,
        read: false,
        username: 'miguel'
      }
    ]));

    adminAccessService = jasmine.createSpyObj<AdminAccessService>('AdminAccessService', ['check']);
    adminAccessService.check.and.returnValue(of(void 0));

    await TestBed.configureTestingModule({
      declarations: [MenuComponent],
      imports: TEST_IMPORTS,
      providers: [
        ...TEST_PROVIDERS,
        { provide: AuthenticationService, useValue: authenticationService },
        { provide: MyProfileService, useValue: profileService },
        { provide: NotificationApiService, useValue: notificationService },
        { provide: AdminAccessService, useValue: adminAccessService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(MenuComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('preserves account, session, community and admin links in the Premium account hub', () => {
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.dashboard-page.jynlo-c1.jynlo-secondary')).not.toBeNull();
    for (const route of ['/menu/events', '/menu/createEvent', '/menu/communities',
      '/menu/dadosPerfil', '/menu/alterardados', '/menu/alterarPassword', '/menu/admin']) {
      expect(root.querySelector('a[href="' + route + '"]')).withContext(route).not.toBeNull();
    }
    expect(root.querySelectorAll('a.hero-action').length).toBe(2);
  });

  it('translates community and admin cards into English without changing their routes', async () => {
    const previous = localStorage.getItem('d24-language');
    const i18n = TestBed.inject(I18nService);
    try {
      await preloadEnglishTranslations();
      i18n.setLanguage('en');
      fixture.detectChanges();
      const root = fixture.nativeElement as HTMLElement;
      const communities = root.querySelector<HTMLAnchorElement>('a[href="/menu/communities"]');
      const admin = root.querySelector<HTMLAnchorElement>('a[href="/menu/admin"]');
      expect(communities?.textContent).toContain('Communities');
      expect(communities?.textContent).toContain('invite players');
      expect(admin?.textContent).toContain('Administration');
      expect(admin?.textContent).toContain('Moderation');
      expect(communities?.getAttribute('href')).toBe('/menu/communities');
      expect(admin?.getAttribute('href')).toBe('/menu/admin');
    } finally {
      i18n.setLanguage(previous === 'en' ? 'en' : 'pt');
      if (previous === null) localStorage.removeItem('d24-language');
    }
  });

  it('should create and load dashboard data', () => {
    expect(component).toBeTruthy();
    expect(profileService.get).toHaveBeenCalled();
    expect(notificationService.mine).toHaveBeenCalled();
    expect(component.profile?.username).toBe('miguel');
    expect(component.unreadNotifications).toBe(1);
    expect(adminAccessService.check).toHaveBeenCalled();
    expect(component.isAdmin).toBeTrue();
  });

  it('should terminate the remote session and clear local authentication', () => {
    component.logout();

    expect(authenticationService.terminarSessao).toHaveBeenCalled();
    expect(authenticationService.logOut).toHaveBeenCalled();
  });
});
