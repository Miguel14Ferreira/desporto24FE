import { Injectable } from '@angular/core';
import { HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, catchError, throwError } from 'rxjs';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  constructor(private router: Router) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const token = localStorage.getItem('t');

    if (!token || request.headers.has('Authorization')) {
      return next.handle(request);
    }

    const authenticatedRequest = request.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });

    return next.handle(authenticatedRequest).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401) {
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

        return throwError(() => error);
      })
    );
  }
}
