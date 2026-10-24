import {
  HttpBackend,
  HttpErrorResponse,
  HttpHandler,
  HttpRequest,
  HttpResponse
} from '@angular/common/http';
import { Router } from '@angular/router';
import { forkJoin, of, throwError } from 'rxjs';

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

  it('recovers an expired backend JWT signalled by its authentication-specific 403', (done) => {
    localStorage.setItem('t', 'old-token');
    const request = new HttpRequest('GET', environment.apiUrl + '/api/communities/mine');
    const sent: string[] = [];
    const next = { handle: (req: HttpRequest<unknown>) => {
      const bearer = req.headers.get('Authorization') ?? '';
      sent.push(bearer);
      return bearer === 'Bearer old-token'
        ? throwError(() => new HttpErrorResponse({
            status: 403,
            error: {
              httpStatusCode: 403,
              message: 'Tu percisas de efetuar o login para aceder a esta página'
            }
          }))
        : of(new HttpResponse({ status: 200, body: [] }));
    } } as HttpHandler;
    backend.handle.and.returnValue(of(new HttpResponse({
      status: 200, body: { token: 'fresh-token' }
    })));

    interceptor.intercept(request, next).subscribe({
      next: response => {
        expect(response instanceof HttpResponse).toBeTrue();
        expect(sent).toEqual(['Bearer old-token', 'Bearer fresh-token']);
        expect(localStorage.getItem('t')).toBe('fresh-token');
        expect(backend.handle).toHaveBeenCalledTimes(1);
        expect(router.navigate).not.toHaveBeenCalled();
        done();
      },
      error: done.fail
    });
  });

  it('does not refresh genuine forbidden community access even with a valid local token', (done) => {
    localStorage.setItem('t', 'member-token');
    const error = new HttpErrorResponse({
      status: 403,
      error: { httpStatusCode: 403, message: 'Não tens permissões suficientes.' }
    });
    const next = { handle: (req: HttpRequest<unknown>) => {
      expect(req.headers.get('Authorization')).toBe('Bearer member-token');
      return throwError(() => error);
    } } as HttpHandler;

    interceptor.intercept(new HttpRequest('GET',
      environment.apiUrl + '/api/communities/42/join-requests'), next).subscribe({
      error: received => {
        expect(received).toBe(error);
        expect(backend.handle).not.toHaveBeenCalled();
        expect(router.navigate).not.toHaveBeenCalled();
        expect(localStorage.getItem('t')).toBe('member-token');
        done();
      }
    });
  });

  it('keeps the renewed session when a retried community request is forbidden', (done) => {
    localStorage.setItem('t', 'expired-token');
    const request = new HttpRequest('GET',
      environment.apiUrl + '/api/communities/42/join-requests');
    let attempt = 0;
    const next = { handle: (req: HttpRequest<unknown>) => {
      attempt++;
      if (attempt === 1) {
        expect(req.headers.get('Authorization')).toBe('Bearer expired-token');
        return throwError(() => new HttpErrorResponse({
          status: 403,
          error: {
            httpStatusCode: 403,
            message: 'Tu percisas de efetuar o login para aceder a esta página'
          }
        }));
      }
      expect(req.headers.get('Authorization')).toBe('Bearer renewed-token');
      return throwError(() => new HttpErrorResponse({
        status: 403,
        error: { httpStatusCode: 403, message: 'NOT_ENOUGH_PERMISSION' }
      }));
    } } as HttpHandler;
    backend.handle.and.returnValue(of(new HttpResponse({
      status: 200, body: { token: 'renewed-token' }
    })));

    interceptor.intercept(request, next).subscribe({
      next: () => done.fail('An unauthorized community action must remain forbidden'),
      error: error => {
        expect(error.status).toBe(403);
        expect(attempt).toBe(2);
        expect(backend.handle).toHaveBeenCalledTimes(1);
        expect(localStorage.getItem('t')).toBe('renewed-token');
        expect(router.navigate).not.toHaveBeenCalled();
        done();
      }
    });
  });

  it('clears the session if the backend authentication 403 is followed by rejected refresh', (done) => {
    localStorage.setItem('t', 'expired-token');
    const next = { handle: () => throwError(() => new HttpErrorResponse({
      status: 403,
      error: {
        httpStatusCode: 403,
        message: 'Tu percisas de efetuar o login para aceder a esta página'
      }
    })) } as HttpHandler;
    backend.handle.and.returnValue(throwError(() => new HttpErrorResponse({ status: 400 })));

    interceptor.intercept(new HttpRequest('GET',
      environment.apiUrl + '/api/communities/mine'), next).subscribe({
      error: () => {
        expect(localStorage.getItem('t')).toBeNull();
        expect(router.navigate).toHaveBeenCalledWith(['/login'], {
          queryParams: { sessionExpired: '1', returnUrl: '/menu/events/42?join=1' }
        });
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

  it('coordinates two tabs so the same refresh cookie is not consumed twice', (done) => {
    if (!navigator.locks?.request) {
      pending('Web Locks API not available in this browser');
      return;
    }

    const jwt = (marker: string) => {
      const encode = (value: object) => btoa(JSON.stringify(value))
        .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
      return encode({ alg: 'HS512', typ: 'JWT' }) + '.'
        + encode({ sub: 'same-user', exp: Math.floor(Date.now() / 1000) + 3600, marker })
        + '.fixture';
    };

    const oldToken = jwt('old');
    const freshToken = jwt('fresh');
    localStorage.setItem('t', oldToken);
    const anotherTab = new AuthInterceptor(router, backend);
    backend.handle.and.returnValue(of(new HttpResponse({
      status: 200, body: { token: freshToken }
    })));

    const next = {
      handle: (request: HttpRequest<unknown>) => {
        return request.headers.get('Authorization') === 'Bearer ' + oldToken
          ? throwError(() => new HttpErrorResponse({ status: 401 }))
          : of(new HttpResponse({ status: 200, body: [] }));
      }
    } as HttpHandler;

    const request = new HttpRequest('GET', environment.apiUrl + '/api/communities/mine');
    forkJoin([
      interceptor.intercept(request, next),
      anotherTab.intercept(request, next)
    ]).subscribe({
      next: () => {
        expect(backend.handle).toHaveBeenCalledTimes(1);
        expect(localStorage.getItem('t')).toBe(freshToken);
        expect(router.navigate).not.toHaveBeenCalled();
        done();
      },
      error: done.fail
    });
  });

  it('does not erase a newer cross-tab token after an old refresh is rejected', (done) => {
    localStorage.setItem('t', 'old-access-token');
    const next = {
      handle: () => throwError(() => new HttpErrorResponse({ status: 401 }))
    } as HttpHandler;
    backend.handle.and.callFake(() => {
      localStorage.setItem('t', 'token-from-another-tab');
      return throwError(() => new HttpErrorResponse({ status: 400 }));
    });

    interceptor.intercept(new HttpRequest('GET', '/api/sessions/1'), next)
      .subscribe({
        next: () => done.fail('Old request must fail'),
        error: () => {
          expect(localStorage.getItem('t')).toBe('token-from-another-tab');
          expect(router.navigate).not.toHaveBeenCalled();
          done();
        }
      });
  });

});
