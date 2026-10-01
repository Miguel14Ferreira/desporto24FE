import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';
import { Observable, catchError, map, of } from 'rxjs';

import { AdminAccessService } from '../services/admin-access.service';

@Injectable({ providedIn: 'root' })
export class AdminGuard implements CanActivate {
  constructor(
    private adminAccessService: AdminAccessService,
    private router: Router
  ) {}

  canActivate(): Observable<boolean | UrlTree> {
    return this.adminAccessService.check().pipe(
      map(() => true),
      catchError(() => of(this.router.createUrlTree(['/menu'])))
    );
  }
}
