import {
  HttpBackend,
  HttpErrorResponse,
  HttpHandler,
  HttpRequest,
  HttpResponse
} from '@angular/common/http';
import { Router } from '@angular/router';
import { fakeAsync, tick } from '@angular/core/testing';
import { NEVER, of, throwError } from 'rxjs';

import { AuthInterceptor } from './auth.interceptor';

describe('AuthInterceptor', () => {
  let interceptor: AuthInterceptor;
  let router: jasmine.SpyObj<Router>;
  let backend: jasmine.SpyObj<HttpBackend>;

  beforeEach(() => {
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    backend = jasmine.createSpyObj<HttpBackend>('HttpBackend', ['handle']);
    Object.defineProperty(router, 'url', { configurable: true, value: '/menu/events/42?join=1' });
    interceptor = new AuthInterceptor(router, backend);
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should attach the stored bearer token', (done) => {
    localStorage.setItem('t', 'test-token');
    const request = new HttpRequest('GET', '/api/sessions/1');

    const next = {
      handle: (handledRequest: HttpRequest<unknown>) => {
        expect(handledRequest.headers.get('Authorization')).toBe('Bearer test-token');
        return of(new HttpResponse({ status: 200 }));
      }
    } as HttpHandler;

    interceptor.intercept(request, next).subscribe(() => done());
  });

  it('should not refresh the session when Google login returns 401', (done) => {
    const request = new HttpRequest('POST', '/api/auth/google/login', { credential: 'invalid' });
    const next = {
      handle: () => throwError(() => new HttpErrorResponse({ status: 401 }))
    } as HttpHandler;

    interceptor.intercept(request, next).subscribe({
      error: error => {
        expect(error.status).toBe(401);
        expect(backend.handle).not.toHaveBeenCalled();
        expect(router.navigate).not.toHaveBeenCalled();
        done();
      }
    });
  });

  it('should not refresh the session when Google registration returns 401', (done) => {
    const request = new HttpRequest('POST', '/api/auth/google/register', {});
    const next = {
      handle: () => throwError(() => new HttpErrorResponse({ status: 401 }))
    } as HttpHandler;

    interceptor.intercept(request, next).subscribe({
      error: error => {
        expect(error.status).toBe(401);
        expect(backend.handle).not.toHaveBeenCalled();
        expect(router.navigate).not.toHaveBeenCalled();
        done();
      }
    });
  });

  it('should keep the session on a temporary refresh outage', (done) => {
    localStorage.setItem('t', 'expired-token');
    const request = new HttpRequest('GET', '/api/sessions/1');

    const next = {
      handle: () => throwError(() => new HttpErrorResponse({ status: 401 }))
    } as HttpHandler;

    backend.handle.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 503 }))
    );

    interceptor.intercept(request, next).subscribe({
      error: () => {
        expect(localStorage.getItem('t')).toBe('expired-token');
        expect(router.navigate).not.toHaveBeenCalled();
        done();
      }
    });
  });

  it('should clear the session when refresh is definitively rejected', (done) => {
    localStorage.setItem('t', 'expired-token');
    const request = new HttpRequest('GET', '/api/sessions/1');

    const next = {
      handle: () => throwError(() => new HttpErrorResponse({ status: 401 }))
    } as HttpHandler;

    backend.handle.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 400 }))
    );

    interceptor.intercept(request, next).subscribe({
      error: () => {
        expect(localStorage.getItem('t')).toBeNull();
        expect(router.navigate).toHaveBeenCalledWith(['/login'], {
          queryParams: { sessionExpired: '1', returnUrl: '/menu/events/42?join=1' }
        });
        done();
      }
    });
  });

  it('times out a stuck refresh without logging out and can retry a later request', fakeAsync(() => {
    localStorage.setItem('t', 'expired-token');
    const request = new HttpRequest('GET', '/api/admin/overview');
    const next = {
      handle: (req: HttpRequest<unknown>) => req.headers.get('Authorization') === 'Bearer valid-token'
        ? of(new HttpResponse({ status: 200 }))
        : throwError(() => new HttpErrorResponse({ status: 401 }))
    } as HttpHandler;
    backend.handle.and.returnValues(
      NEVER,
      of(new HttpResponse({ status: 200, body: { token: 'valid-token' } }))
    );

    let firstError: unknown;
    interceptor.intercept(request, next).subscribe({ error: error => firstError = error });
    tick(10_001);

    expect(firstError).toBeTruthy();
    expect(localStorage.getItem('t')).toBe('expired-token');
    expect(router.navigate).not.toHaveBeenCalled();
    expect(backend.handle).toHaveBeenCalledTimes(1);

    let success = false;
    interceptor.intercept(request, next).subscribe({ next: () => success = true });
    expect(success).toBeTrue();
    expect(localStorage.getItem('t')).toBe('valid-token');
    expect(backend.handle).toHaveBeenCalledTimes(2);
  }));
});
