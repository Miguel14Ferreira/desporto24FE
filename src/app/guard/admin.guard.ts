import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { Observable, catchError, map, of } from 'rxjs';

import { AuthenticationService } from '../services/authethication.service';
import { AdminAccessService } from '../services/admin-access.service';

@Injectable({ providedIn: 'root' })
export class AdminGuard implements CanActivate {
  constructor(
    private authenticationService: AuthenticationService,
    private adminAccessService: AdminAccessService,
    private router: Router
  ) {}

  canActivate(): boolean | UrlTree | Observable<boolean | UrlTree> {
    if (!this.authenticationService.hasValidToken()) {
      return this.router.createUrlTree(['/login']);
    }

    return this.adminAccessService.check().pipe(
      map(() => true),
      catchError(() => of(this.router.createUrlTree(['/menu'])))
    );
  }
}
