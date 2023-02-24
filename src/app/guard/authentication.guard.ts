import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { Observable } from 'rxjs';
import { NotificationType } from '../enum/notification-type.enum';
import { LoginperfilService } from '../services/loginperfil.service';
import { NotificationService } from '../services/notification.service';

@Injectable({providedIn: 'root'})
export class AuthenticationGuard implements CanActivate {

  constructor(private loginPerfilService: LoginperfilService, private router: Router,private notificationService: NotificationService){}

  canActivate(
    next: ActivatedRouteSnapshot,
    state: RouterStateSnapshot): boolean {
    return this.isUserLoggedIn();
  }
  private isUserLoggedIn(): boolean{
    if (this.loginPerfilService.isLoggedIn()){
      return true;
    } else {
      this.router.navigate(['/login']);
      this.notificationService.notify(NotificationType.ERROR, `Percisas de efetuar o login para conseguires aceder a esta página!`);
      return false;
    }
  }
}
