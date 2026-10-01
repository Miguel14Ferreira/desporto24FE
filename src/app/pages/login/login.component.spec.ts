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
      ['login', 'hasValidToken', 'saveToken']
    );
    auth.hasValidToken.and.returnValue(false);
    auth.login.and.returnValue(of({
      mfaRequired: false,
      challengeId: null,
      expiresAt: null,
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

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should save a JWT and navigate after normal login', () => {
    component.username = 'miguel';
    component.password = 'password-123';

    component.onLogin();

    expect(auth.login).toHaveBeenCalledWith('miguel', 'password-123');
    expect(auth.saveToken).toHaveBeenCalledWith('jwt-token');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/menu');
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
