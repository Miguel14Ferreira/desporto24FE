import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EMPTY, of, Subject } from 'rxjs';

import { NavbarComponent } from './navbar.component';
import { AuthenticationService } from '../../services/authethication.service';
import { DirectChatRealtimeService } from '../../services/direct-chat-realtime.service';
import { NotificationApiService } from '../../services/notification-api.service';
import { TEST_IMPORTS, TEST_PROVIDERS } from '../../testing/test-providers';

describe('NavbarComponent', () => {
  let component: NavbarComponent;
  let fixture: ComponentFixture<NavbarComponent>;
  let authService: jasmine.SpyObj<AuthenticationService>;
  let realtimeService: jasmine.SpyObj<DirectChatRealtimeService>;
  let notificationService: jasmine.SpyObj<NotificationApiService>;

  beforeEach(async () => {
    authService = jasmine.createSpyObj<AuthenticationService>(
      'AuthenticationService',
      ['hasSessionCandidate', 'hasAnyRole', 'terminarSessao', 'logOut']
    );
    authService.hasSessionCandidate.and.returnValue(false);
    authService.terminarSessao.and.returnValue(of(undefined));

    realtimeService = jasmine.createSpyObj<DirectChatRealtimeService>(
      'DirectChatRealtimeService',
      ['connect', 'disconnect'],
      { messages$: EMPTY }
    );

    notificationService = jasmine.createSpyObj<NotificationApiService>(
      'NotificationApiService', ['unreadCount']
    );
    notificationService.unreadCount.and.returnValue(of(0));

    await TestBed.configureTestingModule({
      declarations: [NavbarComponent],
      imports: TEST_IMPORTS,
      providers: [
        ...TEST_PROVIDERS,
        { provide: AuthenticationService, useValue: authService },
        { provide: DirectChatRealtimeService, useValue: realtimeService },
        { provide: NotificationApiService, useValue: notificationService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(NavbarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('keeps the essential actions in the main nav and secondary actions in the menu', () => {
    component.authenticated = true;
    fixture.detectChanges();

    const nav: HTMLElement = fixture.nativeElement.querySelector('.site-nav__links');
    const primaryLinks = Array.from(nav.querySelectorAll<HTMLAnchorElement>(
      ':scope > a.desktop-primary-link'
    )).map(anchor => anchor.getAttribute('href'));
    expect(primaryLinks).toEqual(['/menu/feed', '/menu/createEvent']);
    expect(nav.querySelector('a[href="/menu/discover"]')).toBeTruthy();
    expect(nav.querySelector(':scope > a.nav-communities-link[href="/menu/communities"]')).toBeTruthy();
    expect(nav.querySelector('a[href="/menu/notifications"]')).toBeTruthy();

    const menu = nav.querySelector('details.account-menu');
    expect(menu?.querySelector('a[href="/menu/my-sessions"]')).toBeTruthy();
    expect(menu?.querySelector('a[href="/menu/communities"]')).toBeFalsy();
    expect(menu?.querySelector('a[href="/menu/messages"]')).toBeTruthy();
    expect(menu?.querySelector('a[href="/menu/dadosPerfil"]')).toBeTruthy();
    expect(menu?.querySelector('.language-switch')).toBeTruthy();
    expect(menu?.querySelector('.logout-action')).toBeTruthy();
  });

  it('keeps a single direct Communities link when authenticated', () => {
    component.authenticated = true;
    fixture.detectChanges();

    const nav: HTMLElement = fixture.nativeElement.querySelector('.site-nav__links');
    const links = Array.from(nav.querySelectorAll<HTMLAnchorElement>('a[href="/menu/communities"]'));
    expect(links.length).toBe(1);
    expect(links[0].classList.contains('nav-communities-link')).toBeTrue();
    expect(links[0].closest('.account-menu')).toBeNull();
  });

  it('uses the shared pill shape for the account menu without losing toggle behaviour', () => {
    component.authenticated = true;
    fixture.detectChanges();

    const menu = fixture.nativeElement.querySelector('details.account-menu') as HTMLDetailsElement;
    const trigger = menu.querySelector('summary') as HTMLElement;

    expect(trigger.classList.contains('jynlo-action')).toBeTrue();
    expect(trigger.classList.contains('jynlo-action--neutral')).toBeTrue();
    expect(menu.open).toBeFalse();

    trigger.click();
    fixture.detectChanges();
    expect(menu.open).toBeTrue();

    trigger.click();
    fixture.detectChanges();
    expect(menu.open).toBeFalse();
  });

  it('closes the account menu when Escape is pressed', () => {
    component.authenticated = true;
    fixture.detectChanges();

    const menu = fixture.nativeElement.querySelector('details.account-menu') as HTMLDetailsElement;
    expect(menu).toBeTruthy();
    menu.open = true;

    document.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true
    }));
    fixture.detectChanges();

    expect(menu.open).toBeFalse();
  });

  it('keeps the main CTA and logout aligned without styling language toggles as pills', () => {
    component.authenticated = true;
    fixture.detectChanges();

    const root: HTMLElement = fixture.nativeElement;
    const createAction = root.querySelector('a.nav-create-action');
    const logoutAction = root.querySelector('button.logout-action');
    const languageToggles = root.querySelectorAll('.language-switch button');

    expect(createAction?.classList.contains('jynlo-action')).toBeTrue();
    expect(createAction?.classList.contains('jynlo-action--accent')).toBeTrue();
    expect(logoutAction?.classList.contains('jynlo-action')).toBeTrue();
    expect(logoutAction?.classList.contains('jynlo-action--danger')).toBeTrue();
    expect(languageToggles.length).toBe(2);
    languageToggles.forEach(button => expect(button.classList.contains('jynlo-action')).toBeFalse());
  });

  it('uses matching pill geometry for register and login without changing language toggles', () => {
    const root: HTMLElement = fixture.nativeElement;
    const register = root.querySelector('a.register-link') as HTMLAnchorElement;
    const login = root.querySelector('a.login-link') as HTMLAnchorElement;

    expect(register.getAttribute('href')).toBe('/login/registerNewUser');
    expect(login.getAttribute('href')).toBe('/login');
    expect(register.classList.contains('jynlo-action')).toBeTrue();
    expect(login.classList.contains('jynlo-action')).toBeTrue();
    expect(register.classList.contains('jynlo-action--accent')).toBeTrue();
    expect(login.classList.contains('jynlo-action--neutral')).toBeTrue();

    const languageToggles = root.querySelectorAll('.language-switch button');
    expect(languageToggles.length).toBe(2);
    languageToggles.forEach(button => expect(button.classList.contains('jynlo-action')).toBeFalse());
  });

  it('enables logout again after logging out and signing in without refreshing the SPA', () => {
    const logoutResponse = new Subject<void>();
    authService.terminarSessao.and.returnValue(logoutResponse.asObservable());

    // The app keeps the same NavbarComponent mounted across route changes.
    component.authenticated = true;
    fixture.detectChanges();

    let button = fixture.nativeElement.querySelector('.logout-action') as HTMLButtonElement;
    expect(button.disabled).toBeFalse();

    button.click();
    fixture.detectChanges();
    expect(button.disabled).toBeTrue();
    expect(component.loggingOut).toBeTrue();
    expect(authService.terminarSessao).toHaveBeenCalledTimes(1);

    logoutResponse.next();
    logoutResponse.complete();
    expect(authService.logOut).toHaveBeenCalledTimes(1);

    // The router reaches /login after AuthenticationService has cleared the JWT.
    authService.hasSessionCandidate.and.returnValue(false);
    (component as any).syncAuthenticatedState();
    expect(component.loggingOut).toBeFalse();

    // A new login arrives without refreshing or replacing the navbar instance.
    authService.hasSessionCandidate.and.returnValue(true);
    (component as any).syncAuthenticatedState();
    fixture.detectChanges();

    button = fixture.nativeElement.querySelector('.logout-action') as HTMLButtonElement;
    expect(button).toBeTruthy();
    expect(button.disabled).toBeFalse();
    expect(component.loggingOut).toBeFalse();
  });

  it('should create without opening a chat connection when unauthenticated', () => {
    expect(component).toBeTruthy();
    expect(authService.hasSessionCandidate).toHaveBeenCalled();
    expect(component.authenticated).toBeFalse();
    expect(realtimeService.connect).not.toHaveBeenCalled();
    expect(realtimeService.disconnect).toHaveBeenCalled();
  });
});
