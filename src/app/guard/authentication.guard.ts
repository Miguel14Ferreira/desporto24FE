import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { NotificationType } from '../enum/notification-type.enum';
import { AuthenticationService } from '../services/authethication.service';
import { NotificationService } from '../services/notification.service';

@Injectable({providedIn: 'root'})
export class AuthenticationGuard implements CanActivate {

  constructor(private authenticationService: AuthenticationService, private router: Router,private notificationService: NotificationService){}

  canActivate(
    next: ActivatedRouteSnapshot,
    state: RouterStateSnapshot): boolean {
    return this.isUserLoggedIn();
  }
  private isUserLoggedIn(): boolean{
    if (this.authenticationService.isLoggedIn()){
      return true;
    } else {
      this.router.navigate(['/login']);
      this.notificationService.notify(NotificationType.ERROR, `Percisas de efetuar o login para conseguires aceder a esta página!`);
      return false;
    }
  }
}
