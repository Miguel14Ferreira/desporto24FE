import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { firstValueFrom, timeout } from 'rxjs';

import { AuthenticationService } from '../services/authethication.service';

/** Keep account creation for visitors without interrupting authenticated sessions. */
@Injectable({ providedIn: 'root' })
export class GuestOnlyGuard {
  constructor(
    private router: Router,
    private authenticationService: AuthenticationService
  ) {}

  async canActivate(
    _route: ActivatedRouteSnapshot,
    _state: RouterStateSnapshot
  ): Promise<boolean | UrlTree> {
    if (this.authenticationService.isLoggedIn()) {
      return this.router.createUrlTree(['/menu/feed']);
    }

    try {
      // An expired or missing access token can still have a valid refresh cookie.
      const refreshed = await firstValueFrom(
        this.authenticationService.refreshSession().pipe(timeout(8_000))
      );
      return refreshed.token
        ? this.router.createUrlTree(['/menu/feed'])
        : true;
    } catch {
      // Missing/expired cookies and temporary API errors must not block visitors.
      return true;
    }
  }
}
