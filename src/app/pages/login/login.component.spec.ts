import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';

import { LoginComponent } from './login.component';
import { AuthenticationService } from '../../services/authethication.service';
import { TEST_IMPORTS, TEST_PROVIDERS } from '../../testing/test-providers';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let auth: jasmine.SpyObj<AuthenticationService>;
  let router: Router;

  beforeEach(async () => {
    auth = jasmine.createSpyObj<AuthenticationService>(
      'AuthenticationService',
      ['login', 'hasValidToken', 'saveToken', 'googleConfig']
    );
    auth.hasValidToken.and.returnValue(false);
    auth.googleConfig.and.returnValue(of({ clientId: '' }));
    auth.login.and.returnValue(of({
      mfaRequired: false,
      challengeId: null,
      challengeExpiresAt: null,
      token: 'jwt-token',
      profile: null
    }));

    await TestBed.configureTestingModule({
      declarations: [LoginComponent],
      imports: TEST_IMPORTS,
      providers: [
        ...TEST_PROVIDERS,
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap({})
            }
          }
        },
        { provide: AuthenticationService, useValue: auth }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    spyOn(router, 'navigateByUrl').and.returnValue(Promise.resolve(true));
    spyOn(router, 'navigate').and.returnValue(Promise.resolve(true));
    fixture.detectChanges();
  });

  afterEach(() => sessionStorage.clear());

  it('should explain the request login and return to notifications after signing in', () => {
    const route = TestBed.inject(ActivatedRoute);
    route.snapshot.queryParamMap = convertToParamMap({ returnUrl: '/menu/notifications' });
    component.ngOnInit();
    fixture.detectChanges();

    expect(component.loginContextKey).toBe('login.viewRequest');
    expect(fixture.nativeElement.querySelector('.login-context')).not.toBeNull();
    component.username = 'fixture-user';
    component.password = 'fixture-password';
    component.onLogin();
    expect(router.navigateByUrl).toHaveBeenCalledWith('/menu/notifications');
  });

  it('should preserve the request destination while MFA is required', () => {
    const route = TestBed.inject(ActivatedRoute);
    route.snapshot.queryParamMap = convertToParamMap({ returnUrl: '/menu/notifications' });
    component.ngOnInit();
    auth.login.and.returnValue(of({
      mfaRequired: true, challengeId: 'fixture-challenge', challengeExpiresAt: null,
      token: null, profile: null
    }));
    component.username = 'fixture-user';
    component.password = 'fixture-password';
    component.onLogin();
    expect(sessionStorage.getItem('mfa-return-url')).toBe('/menu/notifications');
  });

  it('should not show the request message for a normal login', () => {
    expect(component.loginContextKey).toBe('');
    expect(fixture.nativeElement.querySelector('.login-context')).toBeNull();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should save a JWT and navigate after normal login', () => {
    component.username = 'miguel';
    component.password = 'password-123';

    component.onLogin();

    expect(auth.login).toHaveBeenCalledWith('miguel', 'password-123');
    expect(auth.saveToken).toHaveBeenCalledWith('jwt-token');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/menu/feed');
  });

  it('should store the MFA challenge instead of a JWT', () => {
    auth.login.and.returnValue(of({
      mfaRequired: true,
      challengeId: 'challenge-123',
      expiresAt: '2026-09-26T00:05:00Z',
      token: null,
      profile: null
    }));
    component.username = 'miguel';
    component.password = 'password-123';

    component.onLogin();

    expect(sessionStorage.getItem('mfa-challenge-id')).toBe('challenge-123');
    expect(auth.saveToken).not.toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/login/MFAauthentication']);
  });
});
