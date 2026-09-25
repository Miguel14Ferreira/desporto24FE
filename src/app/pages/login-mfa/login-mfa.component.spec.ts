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
      expiresAt: '2026-09-26T00:05:00Z',
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

  it('should confirm MFA and save the returned JWT', () => {
    component.code = 'ABC12345';

    component.confirmCode();

    expect(auth.confirmMfaChallenge).toHaveBeenCalledWith('challenge-123', 'ABC12345');
    expect(auth.saveToken).toHaveBeenCalledWith('jwt-token');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/menu');
  });

  it('should replace the challenge when resending', () => {
    component.resendCode();

    expect(auth.resendMfaChallenge).toHaveBeenCalledWith('challenge-123');
    expect(component.challengeId).toBe('challenge-456');
    expect(sessionStorage.getItem('mfa-challenge-id')).toBe('challenge-456');
  });
});
