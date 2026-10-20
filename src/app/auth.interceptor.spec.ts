import {
  HttpBackend,
  HttpErrorResponse,
  HttpHandler,
  HttpRequest,
  HttpResponse
} from '@angular/common/http';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';

import { AuthInterceptor } from './auth.interceptor';
import { environment } from '../environment/environment';

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

  it('limits bearer tokens to the configured Jynlo API origin', () => {
    localStorage.setItem('t', 'sensitive-fixture-token');
    const seen: HttpRequest<unknown>[] = [];
    const next = { handle: (req: HttpRequest<unknown>) => {
      seen.push(req);
      return of(new HttpResponse({ status: 200 }));
    } } as HttpHandler;

    for (const url of [
      'https://example.org/image',
      'https://api.d24sports.com.attacker.invalid/api/sessions',
      'https://maps.googleapis.com/maps/api/place/details',
      environment.apiUrl + '/other-service',
      '/assets/sport.svg',
      '//untrusted.invalid/api/sessions'
    ]) {
      interceptor.intercept(new HttpRequest('GET', url), next).subscribe();
    }

    expect(seen.length).toBe(6);
    expect(seen.every(req => !req.headers.has('Authorization'))).toBeTrue();
    expect(backend.handle).not.toHaveBeenCalled();

    interceptor.intercept(new HttpRequest('GET',
      environment.apiUrl + '/api/sessions/42'), next).subscribe();
    expect(seen[6].headers.get('Authorization')).toBe('Bearer sensitive-fixture-token');
  });

  it('does not refresh or redirect for a third-party HTTP 401', (done) => {
    localStorage.setItem('t', 'fixture-token');
    const next = { handle: (req: HttpRequest<unknown>) => {
      expect(req.headers.has('Authorization')).toBeFalse();
      return throwError(() => new HttpErrorResponse({ status: 401 }));
    } } as HttpHandler;
    interceptor.intercept(new HttpRequest('GET', 'https://cdn.example.org/private.png'), next)
      .subscribe({ error: error => {
        expect(error.status).toBe(401);
        expect(backend.handle).not.toHaveBeenCalled();
        expect(router.navigate).not.toHaveBeenCalled();
        expect(localStorage.getItem('t')).toBe('fixture-token');
        done();
      } });
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
});
