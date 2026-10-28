import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';

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
  let incomingMessages: Subject<any>;
  let notificationChanges: Subject<void>;
  let originalTabTitle: string;

  beforeEach(async () => {
    originalTabTitle = document.title;
    authService = jasmine.createSpyObj<AuthenticationService>(
      'AuthenticationService',
      ['hasSessionCandidate', 'hasAnyRole', 'terminarSessao', 'logOut']
    );
    authService.hasSessionCandidate.and.returnValue(false);
    authService.terminarSessao.and.returnValue(of(undefined));

    incomingMessages = new Subject<any>();
    realtimeService = jasmine.createSpyObj<DirectChatRealtimeService>(
      'DirectChatRealtimeService',
      ['connect', 'disconnect'],
      { messages$: incomingMessages.asObservable() }
    );

    notificationChanges = new Subject<void>();
    notificationService = jasmine.createSpyObj<NotificationApiService>(
      'NotificationApiService', ['unreadCount'], { changes$: notificationChanges.asObservable() }
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

  afterEach(() => {
    document.title = originalTabTitle;
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

  it('shows an unread notification count in the browser tab and clears it after reading', () => {
    notificationService.unreadCount.and.returnValues(of(7), of(6), of(0));
    authService.hasSessionCandidate.and.returnValue(true);
    (component as any).syncAuthenticatedState();
    expect(component.unreadNotifications).toBe(7);
    expect(document.title).toBe('Jynlo (7) — Join the game.');

    notificationChanges.next();
    expect(document.title).toBe('Jynlo (6) — Join the game.');

    notificationChanges.next();
    expect(component.unreadNotifications).toBe(0);
    expect(document.title).toBe('Jynlo — Join the game.');
  });

  it('uses the same 99+ cap for the browser tab as the navigation badge', () => {
    notificationService.unreadCount.and.returnValue(of(158));
    authService.hasSessionCandidate.and.returnValue(true);
    (component as any).syncAuthenticatedState();
    fixture.detectChanges();
    expect(component.unreadNotifications).toBe(158);
    expect(document.title).toBe('Jynlo (99+) — Join the game.');
    expect(fixture.nativeElement.querySelector('.notification-badge')?.textContent).toContain('99+');
  });

  it('clears the tab count on logout and ignores later notification changes', () => {
    notificationService.unreadCount.and.returnValue(of(4));
    authService.hasSessionCandidate.and.returnValue(true);
    (component as any).syncAuthenticatedState();
    expect(document.title).toBe('Jynlo (4) — Join the game.');

    authService.hasSessionCandidate.and.returnValue(false);
    (component as any).syncAuthenticatedState();
    expect(document.title).toBe('Jynlo — Join the game.');
    notificationChanges.next();
    expect(document.title).toBe('Jynlo — Join the game.');
    expect(notificationService.unreadCount).toHaveBeenCalledTimes(1);
  });

  it('keeps the confirmed tab count after a network error or old response', () => {
    const pending = new Subject<number>();
    notificationService.unreadCount.and.returnValues(
      of(3), pending.asObservable(), throwError(() => new Error('Offline'))
    );
    authService.hasSessionCandidate.and.returnValue(true);
    (component as any).syncAuthenticatedState();
    expect(document.title).toBe('Jynlo (3) — Join the game.');

    component.loadUnreadNotifications();
    component.loadUnreadNotifications();
    pending.next(99);
    pending.complete();
    expect(component.unreadNotifications).toBe(3);
    expect(document.title).toBe('Jynlo (3) — Join the game.');
  });

  it('refreshes the tab count when returning from another browser tab', () => {
    notificationService.unreadCount.and.returnValues(of(5), of(1));
    authService.hasSessionCandidate.and.returnValue(true);
    (component as any).syncAuthenticatedState();
    expect(document.title).toBe('Jynlo (5) — Join the game.');
    window.dispatchEvent(new Event('focus'));
    expect(document.title).toBe('Jynlo (1) — Join the game.');
  });

  it('updates the badge immediately on confirmed changes without navigating', () => {
    notificationService.unreadCount.and.returnValues(of(4), of(3), of(0));
    authService.hasSessionCandidate.and.returnValue(true);
    (component as any).syncAuthenticatedState();
    expect(component.unreadNotifications).toBe(4);

    notificationChanges.next();
    expect(notificationService.unreadCount).toHaveBeenCalledTimes(2);
    expect(component.unreadNotifications).toBe(3);

    notificationChanges.next();
    expect(notificationService.unreadCount).toHaveBeenCalledTimes(3);
    expect(component.unreadNotifications).toBe(0);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.notification-badge')).toBeNull();
    component.ngOnDestroy();
  });

  it('ignores notification-change events after logout', () => {
    authService.hasSessionCandidate.and.returnValue(true);
    (component as any).syncAuthenticatedState();
    expect(notificationService.unreadCount).toHaveBeenCalledTimes(1);

    authService.hasSessionCandidate.and.returnValue(false);
    (component as any).syncAuthenticatedState();
    notificationChanges.next();

    expect(component.unreadNotifications).toBe(0);
    expect(notificationService.unreadCount).toHaveBeenCalledTimes(1);
    component.ngOnDestroy();
  });

  it('keeps the badge hidden for muted chat even when realtime messages arrive', fakeAsync(() => {
    authService.hasSessionCandidate.and.returnValue(true);
    // Server respects CHAT_MESSAGE opt-out and says there are no visible alerts.
    notificationService.unreadCount.and.returnValue(of(0));
    (component as any).syncAuthenticatedState();
    expect(notificationService.unreadCount).toHaveBeenCalledTimes(1);

    incomingMessages.next({ id: 10 });
    incomingMessages.next({ id: 11 });
    incomingMessages.next({ id: 12 });
    expect(component.unreadNotifications).toBe(0);
    tick(299);
    expect(notificationService.unreadCount).toHaveBeenCalledTimes(1);
    tick(1);

    // One coalesced refresh, never an optimistic +3.
    expect(notificationService.unreadCount).toHaveBeenCalledTimes(2);
    expect(component.unreadNotifications).toBe(0);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.notification-badge')).toBeNull();
    component.ngOnDestroy();
  }));

  it('reflects actual server counts and discards obsolete in-flight responses', fakeAsync(() => {
    const pendingOldResponse = new Subject<number>();
    notificationService.unreadCount.and.returnValues(
      pendingOldResponse.asObservable(), of(2), of(3)
    );
    authService.hasSessionCandidate.and.returnValue(true);
    (component as any).syncAuthenticatedState();
    incomingMessages.next({ id: 20 });
    tick(300);
    expect(component.unreadNotifications).toBe(2);

    // Late results from the earlier HTTP request must not replace fresh data.
    pendingOldResponse.next(99);
    pendingOldResponse.complete();
    expect(component.unreadNotifications).toBe(2);

    incomingMessages.next({ id: 21 });
    tick(300);
    expect(component.unreadNotifications).toBe(3);
    expect(notificationService.unreadCount).toHaveBeenCalledTimes(3);
    component.ngOnDestroy();
  }));

  it('keeps the last confirmed badge on a temporary unread endpoint failure', () => {
    authService.hasSessionCandidate.and.returnValue(true);
    notificationService.unreadCount.and.returnValues(
      of(4), throwError(() => new Error('Network offline'))
    );
    (component as any).syncAuthenticatedState();
    expect(component.unreadNotifications).toBe(4);
    component.loadUnreadNotifications();
    expect(component.unreadNotifications).toBe(4);
    component.ngOnDestroy();
  });

  it('should create without opening a chat connection when unauthenticated', () => {
    expect(component).toBeTruthy();
    expect(authService.hasSessionCandidate).toHaveBeenCalled();
    expect(component.authenticated).toBeFalse();
    expect(realtimeService.connect).not.toHaveBeenCalled();
    expect(realtimeService.disconnect).toHaveBeenCalled();
  });
});
