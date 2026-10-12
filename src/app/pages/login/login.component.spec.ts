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
      ['login', 'hasValidToken', 'saveToken', 'googleConfig', 'resendRegistrationConfirmation']
    );
    auth.hasValidToken.and.returnValue(false);
    auth.googleConfig.and.returnValue(of({ clientId: '' }));
    auth.resendRegistrationConfirmation.and.returnValue(of({ message: 'Email reenviado' } as any));
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

  it('should preserve a shared session destination after login', () => {
    TestBed.inject(ActivatedRoute).snapshot.queryParamMap =
      convertToParamMap({ returnUrl: '/menu/events/42' });
    component.ngOnInit();
    component.username = 'fixture-user';
    component.password = 'fixture-password';

    component.onLogin();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/menu/events/42');
  });

  it('should keep a legitimate internal destination with query parameters', () => {
    TestBed.inject(ActivatedRoute).snapshot.queryParamMap =
      convertToParamMap({ returnUrl: '/menu/notifications?view=requests' });
    component.ngOnInit();
    component.username = 'fixture-user';
    component.password = 'fixture-password';

    component.onLogin();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/menu/notifications?view=requests');
  });

  it('should reject external and malformed login return URLs', () => {
    const invalidTargets = [
      'https://example.com',
      '//example.com',
      '/login',
      '/menu/../login',
      '/menu//events/42',
      '/menu/%2e%2e/login',
      '/menu/events%2f42',
      '/menu/events\\42'
    ];

    for (const returnUrl of invalidTargets) {
      TestBed.inject(ActivatedRoute).snapshot.queryParamMap =
        convertToParamMap({ returnUrl });
      component.ngOnInit();
      component.username = 'fixture-user';
      component.password = 'fixture-password';

      component.onLogin();

      expect(router.navigateByUrl).toHaveBeenCalledWith('/menu/feed');
      (router.navigateByUrl as jasmine.Spy).calls.reset();
    }
  });

  it('should store only a validated destination for MFA', () => {
    TestBed.inject(ActivatedRoute).snapshot.queryParamMap =
      convertToParamMap({ returnUrl: '//example.com' });
    component.ngOnInit();
    auth.login.and.returnValue(of({
      mfaRequired: true, challengeId: 'fixture-challenge', challengeExpiresAt: null,
      token: null, profile: null
    }));
    component.username = 'fixture-user';
    component.password = 'fixture-password';

    component.onLogin();

    expect(sessionStorage.getItem('mfa-return-url')).toBe('/menu/feed');
  });

  it('preserves a shared session when resending confirmation after failed login', () => {
    TestBed.inject(ActivatedRoute).snapshot.queryParamMap =
      convertToParamMap({ returnUrl: '/menu/events/42' });
    component.ngOnInit();
    component.username = 'fixture-user';
    spyOn<any>(component, 'startResendCooldown');

    component.resendConfirmation();

    expect(auth.resendRegistrationConfirmation).toHaveBeenCalledWith('fixture-user', 42);
  });

  it('does not forward other login destinations as session IDs', () => {
    TestBed.inject(ActivatedRoute).snapshot.queryParamMap =
      convertToParamMap({ returnUrl: '/menu/notifications' });
    component.ngOnInit();
    component.username = 'fixture-user';
    spyOn<any>(component, 'startResendCooldown');

    component.resendConfirmation();

    expect(auth.resendRegistrationConfirmation).toHaveBeenCalledWith('fixture-user', null);
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
