import { Injectable } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { JwtHelperService } from '@auth0/angular-jwt';
import { firstValueFrom } from 'rxjs';

import { AuthenticationService } from '../services/authethication.service';

@Injectable({ providedIn: 'root' })
export class AuthenticationGuard {
  private readonly jwtHelper = new JwtHelperService();

  constructor(
    private router: Router,
    private authenticationService: AuthenticationService
  ) {}

  async canActivate(
    _next: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Promise<boolean | UrlTree> {
    const token = localStorage.getItem('t');

    if (token) {
      try {
        const expired = await this.jwtHelper.isTokenExpired(token);
        if (!expired) {
          return true;
        }
      } catch {
        // Invalid access token: attempt to recover the session via refresh cookie.
      }
    }

    try {
      const refreshed = await firstValueFrom(this.authenticationService.refreshSession());
      if (refreshed.token) {
        return true;
      }

      return true;
    } catch (error) {
      if (!this.isRefreshRejected(error)) {
        // Keep the current route during temporary API/network outages.
        // The next protected request can try the refresh cookie again.
        return true;
      }
    }

    localStorage.removeItem('t');
    return this.router.createUrlTree(
      ['/login'],
      { queryParams: { returnUrl: state.url, sessionExpired: '1' } }
    );
  }

  private isRefreshRejected(error: unknown): boolean {
    if (!(error instanceof HttpErrorResponse)) {
      return false;
    }

    return [400, 401, 403].includes(error.status);
  }
}
