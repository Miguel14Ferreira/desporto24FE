import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';

import { AuthenticationService } from '../services/authethication.service';

@Injectable({ providedIn: 'root' })
export class AdminGuard implements CanActivate {
  constructor(
    private authenticationService: AuthenticationService,
    private router: Router
  ) {}

  canActivate(): boolean | UrlTree {
    if (!this.authenticationService.hasValidToken()) {
      return this.router.createUrlTree(['/login']);
    }

    if (!this.authenticationService.hasAnyRole('ROLE_ADMIN', 'ROLE_SUPER_ADMIN')) {
      return this.router.createUrlTree(['/menu']);
    }

    return true;
  }
}
