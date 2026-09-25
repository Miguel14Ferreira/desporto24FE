import { HttpHandler, HttpRequest, HttpResponse } from '@angular/common/http';
import { of } from 'rxjs';

import { AuthInterceptor } from './auth.interceptor';

describe('AuthInterceptor', () => {
  let interceptor: AuthInterceptor;

  beforeEach(() => {
    interceptor = new AuthInterceptor();
    localStorage.removeItem('t');
  });

  afterEach(() => {
    localStorage.removeItem('t');
  });

  it('should be created', () => {
    expect(interceptor).toBeTruthy();
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

  it('should leave anonymous requests unchanged', (done) => {
    const request = new HttpRequest('GET', '/api/sessions');

    const next = {
      handle: (handledRequest: HttpRequest<unknown>) => {
        expect(handledRequest.headers.has('Authorization')).toBeFalse();
        return of(new HttpResponse({ status: 200 }));
      }
    } as HttpHandler;

    interceptor.intercept(request, next).subscribe(() => done());
  });
});
