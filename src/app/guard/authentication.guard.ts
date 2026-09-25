import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { JwtHelperService } from '@auth0/angular-jwt';

@Injectable({ providedIn: 'root' })
export class AuthenticationGuard {
  private readonly jwtHelper = new JwtHelperService();

  constructor(private router: Router) {}

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
        // Invalid tokens are handled as unauthenticated.
      }
    }

    return this.router.createUrlTree(
      ['/login'],
      { queryParams: { returnUrl: state.url } }
    );
  }
}
