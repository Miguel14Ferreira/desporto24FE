import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EMPTY } from 'rxjs';

import { NavbarComponent } from './navbar.component';
import { AuthenticationService } from '../../services/authethication.service';
import { DirectChatRealtimeService } from '../../services/direct-chat-realtime.service';
import { TEST_IMPORTS, TEST_PROVIDERS } from '../../testing/test-providers';

describe('NavbarComponent', () => {
  let component: NavbarComponent;
  let fixture: ComponentFixture<NavbarComponent>;
  let authService: jasmine.SpyObj<AuthenticationService>;
  let realtimeService: jasmine.SpyObj<DirectChatRealtimeService>;

  beforeEach(async () => {
    authService = jasmine.createSpyObj<AuthenticationService>(
      'AuthenticationService',
      ['hasSessionCandidate', 'hasAnyRole']
    );
    authService.hasSessionCandidate.and.returnValue(false);

    realtimeService = jasmine.createSpyObj<DirectChatRealtimeService>(
      'DirectChatRealtimeService',
      ['connect', 'disconnect'],
      { messages$: EMPTY }
    );

    await TestBed.configureTestingModule({
      declarations: [NavbarComponent],
      imports: TEST_IMPORTS,
      providers: [
        ...TEST_PROVIDERS,
        { provide: AuthenticationService, useValue: authService },
        { provide: DirectChatRealtimeService, useValue: realtimeService }
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
    expect(nav.querySelector('a[href="/menu/notifications"]')).toBeTruthy();

    const menu = nav.querySelector('details.account-menu');
    expect(menu?.querySelector('a[href="/menu/my-sessions"]')).toBeTruthy();
    expect(menu?.querySelector('a[href="/menu/communities"]')).toBeTruthy();
    expect(menu?.querySelector('a[href="/menu/friendList"]')).toBeTruthy();
    expect(menu?.querySelector('a[href="/menu/dadosPerfil"]')).toBeTruthy();
    expect(menu?.querySelector('.language-switch')).toBeTruthy();
    expect(menu?.querySelector('.logout-action')).toBeTruthy();
  });

  it('should create without opening a chat connection when unauthenticated', () => {
    expect(component).toBeTruthy();
    expect(authService.hasSessionCandidate).toHaveBeenCalled();
    expect(component.authenticated).toBeFalse();
    expect(realtimeService.connect).not.toHaveBeenCalled();
    expect(realtimeService.disconnect).toHaveBeenCalled();
  });
});
