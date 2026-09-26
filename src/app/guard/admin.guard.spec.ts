import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { AdminGuard } from './admin.guard';
import { AuthenticationService } from '../services/authethication.service';
import { TEST_IMPORTS } from '../testing/test-providers';

describe('AdminGuard', () => {
  let guard: AdminGuard;
  let auth: jasmine.SpyObj<AuthenticationService>;
  let router: Router;

  beforeEach(() => {
    auth = jasmine.createSpyObj<AuthenticationService>(
      'AuthenticationService',
      ['hasValidToken', 'hasAnyRole']
    );

    TestBed.configureTestingModule({
      imports: TEST_IMPORTS,
      providers: [
        { provide: AuthenticationService, useValue: auth }
      ]
    });

    guard = TestBed.inject(AdminGuard);
    router = TestBed.inject(Router);
  });

  it('should allow admins', () => {
    auth.hasValidToken.and.returnValue(true);
    auth.hasAnyRole.and.returnValue(true);

    expect(guard.canActivate()).toBeTrue();
    expect(auth.hasAnyRole).toHaveBeenCalledWith('ROLE_ADMIN', 'ROLE_SUPER_ADMIN');
  });

  it('should redirect authenticated non-admins to menu', () => {
    auth.hasValidToken.and.returnValue(true);
    auth.hasAnyRole.and.returnValue(false);

    const result = guard.canActivate();

    expect(router.serializeUrl(result as any)).toBe('/menu');
  });

  it('should redirect unauthenticated users to login', () => {
    auth.hasValidToken.and.returnValue(false);

    const result = guard.canActivate();

    expect(router.serializeUrl(result as any)).toBe('/login');
  });
});
