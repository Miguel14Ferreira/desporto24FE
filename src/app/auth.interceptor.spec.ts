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

describe('AuthInterceptor', () => {
  let interceptor: AuthInterceptor;
  let router: jasmine.SpyObj<Router>;
  let backend: jasmine.SpyObj<HttpBackend>;

  beforeEach(() => {
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    backend = jasmine.createSpyObj<HttpBackend>('HttpBackend', ['handle']);
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
        expect(router.navigate).toHaveBeenCalled();
        done();
      }
    });
  });
});
