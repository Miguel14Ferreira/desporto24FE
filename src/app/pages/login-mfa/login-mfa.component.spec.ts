import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';

import { LoginMFAComponent } from './login-mfa.component';
import { AuthenticationService } from '../../services/authethication.service';
import { TEST_IMPORTS, TEST_PROVIDERS } from '../../testing/test-providers';

describe('LoginMFAComponent', () => {
  let component: LoginMFAComponent;
  let fixture: ComponentFixture<LoginMFAComponent>;
  let auth: jasmine.SpyObj<AuthenticationService>;
  let router: Router;

  beforeEach(async () => {
    sessionStorage.setItem('mfa-challenge-id', 'challenge-123');

    auth = jasmine.createSpyObj<AuthenticationService>(
      'AuthenticationService',
      ['confirmMfaChallenge', 'resendMfaChallenge', 'saveToken']
    );
    auth.confirmMfaChallenge.and.returnValue(of({
      mfaRequired: false,
      challengeId: null,
      expiresAt: null,
      token: 'jwt-token',
      profile: null
    }));
    auth.resendMfaChallenge.and.returnValue(of({
      mfaRequired: true,
      challengeId: 'challenge-456',
      expiresAt: '2099-09-26T00:05:00Z',
      token: null,
      profile: null
    }));

    await TestBed.configureTestingModule({
      declarations: [LoginMFAComponent],
      imports: TEST_IMPORTS,
      providers: [
        ...TEST_PROVIDERS,
        { provide: AuthenticationService, useValue: auth }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(LoginMFAComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    spyOn(router, 'navigateByUrl').and.returnValue(Promise.resolve(true));
    spyOn(router, 'navigate').and.returnValue(Promise.resolve(true));
    fixture.detectChanges();
  });

  afterEach(() => sessionStorage.clear());

  it('should load the active MFA challenge', () => {
    expect(component).toBeTruthy();
    expect(component.challengeId).toBe('challenge-123');
  });

  it('should show the remaining MFA challenge time', () => {
    component.remainingSeconds = 125;

    expect(component.countdownLabel()).toBe('02:05');
  });

  it('should block confirmation after the MFA challenge expires', () => {
    component.expiresAt = new Date(Date.now() - 1000).toISOString();
    component.code = 'ABC12345';

    component.confirmCode();

    expect(auth.confirmMfaChallenge).not.toHaveBeenCalled();
    expect(component.errorMessage).toContain('expirou');
  });

  it('should confirm MFA and save the returned JWT', () => {
    component.code = 'ABC12345';

    component.confirmCode();

    expect(auth.confirmMfaChallenge).toHaveBeenCalledWith('challenge-123', 'ABC12345');
    expect(auth.saveToken).toHaveBeenCalledWith('jwt-token');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/menu/feed');
  });

  it('should resume a shared session after successful MFA', () => {
    sessionStorage.setItem('mfa-return-url', '/menu/events/42');
    component.code = 'ABC12345';

    component.confirmCode();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/menu/events/42');
    expect(sessionStorage.getItem('mfa-return-url')).toBeNull();
  });

  it('should preserve a shared session when cancelling MFA and returning to login', () => {
    sessionStorage.setItem('mfa-return-url', '/menu/events/42');

    component.cancel();

    expect(router.navigate).toHaveBeenCalledWith(['/login'], {
      queryParams: { returnUrl: '/menu/events/42' }
    });
    expect(sessionStorage.getItem('mfa-challenge-id')).toBeNull();
    expect(sessionStorage.getItem('mfa-return-url')).toBeNull();
  });

  it('should replace the challenge when resending', () => {
    component.resendCode();

    expect(auth.resendMfaChallenge).toHaveBeenCalledWith('challenge-123');
    expect(component.challengeId).toBe('challenge-456');
    expect(sessionStorage.getItem('mfa-challenge-id')).toBe('challenge-456');
    expect(component.remainingSeconds).not.toBeNull();
    expect(component.isChallengeExpired()).toBeFalse();
  });
});
