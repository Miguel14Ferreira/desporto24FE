import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { of, throwError } from 'rxjs';

import { GuestOnlyGuard } from './guest-only.guard';
import { AuthenticationService } from '../services/authethication.service';
import { TEST_IMPORTS } from '../testing/test-providers';

describe('GuestOnlyGuard', () => {
  let guard: GuestOnlyGuard;
  let router: Router;
  let auth: jasmine.SpyObj<AuthenticationService>;

  const route = {} as ActivatedRouteSnapshot;
  const state = { url: '/login/registerNewUser' } as RouterStateSnapshot;

  beforeEach(() => {
    auth = jasmine.createSpyObj<AuthenticationService>(
      'AuthenticationService', ['isLoggedIn', 'refreshSession']
    );
    auth.isLoggedIn.and.returnValue(false);

    TestBed.configureTestingModule({
      imports: TEST_IMPORTS,
      providers: [
        GuestOnlyGuard,
        { provide: AuthenticationService, useValue: auth }
      ]
    });

    guard = TestBed.inject(GuestOnlyGuard);
    router = TestBed.inject(Router);
  });

  it('redirects an already authenticated player without showing registration', async () => {
    auth.isLoggedIn.and.returnValue(true);

    const result = await guard.canActivate(route, state);

    expect(router.serializeUrl(result as UrlTree)).toBe('/menu/feed');
    expect(auth.refreshSession).not.toHaveBeenCalled();
  });

  it('redirects when a refresh cookie recovers an authenticated session', async () => {
    auth.refreshSession.and.returnValue(of({ token: 'new-access-token' } as any));

    const result = await guard.canActivate(route, state);

    expect(router.serializeUrl(result as UrlTree)).toBe('/menu/feed');
    expect(auth.refreshSession).toHaveBeenCalledTimes(1);
  });

  it('allows visitors when the refresh session is rejected', async () => {
    auth.refreshSession.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 401 }))
    );

    expect(await guard.canActivate(route, state)).toBeTrue();
  });

  it('allows visitors if the session service is temporarily unavailable', async () => {
    auth.refreshSession.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 503 }))
    );

    expect(await guard.canActivate(route, state)).toBeTrue();
  });

  it('allows visitors when refresh returns no access token', async () => {
    auth.refreshSession.and.returnValue(of({ token: null } as any));

    expect(await guard.canActivate(route, state)).toBeTrue();
  });
});
