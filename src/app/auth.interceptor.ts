import { Injectable } from '@angular/core';
import {
  HttpBackend,
  HttpClient,
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest
} from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, finalize, shareReplay, switchMap, catchError, throwError } from 'rxjs';

import { environment } from '../environment/environment';
import { LoginResponse } from './pages/model/login-response';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  private readonly rawHttp: HttpClient;
  private refreshInFlight?: Observable<LoginResponse>;

  constructor(
    private router: Router,
    httpBackend: HttpBackend
  ) {
    this.rawHttp = new HttpClient(httpBackend);
  }

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const token = localStorage.getItem('t');
    const authenticatedRequest = token && !request.headers.has('Authorization')
      ? request.clone({
          setHeaders: {
            Authorization: `Bearer ${token}`
          }
        })
      : request;

    return next.handle(authenticatedRequest).pipe(
      catchError((error: HttpErrorResponse) => {
        if (
          error.status !== 401
          || request.url.includes('/api/auth/login')
          || request.url.includes('/api/auth/mfa/')
          || request.url.includes('/api/auth/refresh')
        ) {
          return throwError(() => error);
        }

        return this.refreshAccessToken().pipe(
          switchMap(response => {
            if (!response.token) {
              return throwError(() => error);
            }

            const retryRequest = request.clone({
              setHeaders: {
                Authorization: `Bearer ${response.token}`
              }
            });
            return next.handle(retryRequest);
          }),
          catchError(refreshError => {
            this.clearSessionAndRedirect();
            return throwError(() => refreshError);
          })
        );
      })
    );
  }

  private refreshAccessToken(): Observable<LoginResponse> {
    if (!this.refreshInFlight) {
      this.refreshInFlight = this.rawHttp.post<LoginResponse>(
        environment.apiUrl + '/api/auth/refresh',
        null,
        { withCredentials: true }
      ).pipe(
        switchMap(response => {
          if (!response.token) {
            return throwError(() => new Error('Refresh response did not include an access token'));
          }

          localStorage.setItem('t', response.token);
          return [response];
        }),
        finalize(() => this.refreshInFlight = undefined),
        shareReplay(1)
      );
    }

    return this.refreshInFlight;
  }

  private clearSessionAndRedirect(): void {
    localStorage.removeItem('t');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('MFA');
    localStorage.removeItem('Sessao');

    sessionStorage.removeItem('auth-token');
    sessionStorage.removeItem('user-data');
    sessionStorage.removeItem('mfa-challenge-id');
    sessionStorage.removeItem('mfa-expires-at');
    sessionStorage.removeItem('mfa-return-url');

    void this.router.navigate(['/login'], {
      queryParams: { sessionExpired: '1' }
    });
  }
}
