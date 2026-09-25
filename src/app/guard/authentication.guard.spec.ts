import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { JwtHelperService } from '@auth0/angular-jwt';

import { AuthenticationGuard } from './authentication.guard';
import { TEST_IMPORTS } from '../testing/test-providers';

describe('AuthenticationGuard', () => {
  let guard: AuthenticationGuard;
  let router: Router;

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      imports: TEST_IMPORTS
    });

    guard = TestBed.inject(AuthenticationGuard);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should allow a non-expired token', () => {
    localStorage.setItem('t', 'header.payload.signature');
    spyOn(JwtHelperService.prototype, 'isTokenExpired').and.returnValue(false);

    const result = guard.canActivate({} as any, { url: '/menu/events' } as any);

    expect(result).toBeTrue();
  });

  it('should redirect unauthenticated users to login with returnUrl', () => {
    const result = guard.canActivate({} as any, { url: '/menu/events' } as any);

    expect(router.serializeUrl(result as any)).toContain('/login');
    expect(router.serializeUrl(result as any)).toContain('returnUrl');
  });

  it('should redirect expired tokens', () => {
    localStorage.setItem('t', 'header.payload.signature');
    spyOn(JwtHelperService.prototype, 'isTokenExpired').and.returnValue(true);

    const result = guard.canActivate({} as any, { url: '/menu' } as any);

    expect(router.serializeUrl(result as any)).toContain('/login');
  });
});
