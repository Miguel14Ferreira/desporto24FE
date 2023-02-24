import { HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { HeaderType } from 'src/app/enum/header-type.enum';
import { NotificationType } from 'src/app/enum/notification-type.enum';
import { NotificationService } from 'src/app/services/notification.service';
import { AuthService } from 'src/auth.service';
import { LoginperfilService } from '../../services/loginperfil.service';
import { Perfil } from '../model/perfil';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit, OnDestroy {
  perfil = new Perfil();
  username!: string;
  password!: string;
  visible:boolean = true;
  changetype:boolean = true;
  showLoading!: boolean;
  token: any;
  response: any = null;
  subscriptions: Subscription[] = [];
  constructor(private service:LoginperfilService, private router:Router,private authService:AuthService, private notificationService: NotificationService) { }
  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  ngOnInit(): void {
    if(this.service.isLoggedIn()){
      this.router.navigateByUrl('/menu');
    } else {
      this.router.navigateByUrl('/login');
    }
  }
  minhaImagem = "assets/Sports .jpg";
  minhaImagem2 = "assets/olho1.png";
  minhaImagem3 = "assets/olho2.png";

  onLogin(perfil: Perfil): void {
    this.showLoading = true;
    this.subscriptions.push(
      this.service.loginPerfil(perfil).subscribe(
        (response: HttpResponse<Perfil>) => {
          this.token = response.headers.get(HeaderType.JWT_TOKEN);
          this.service.saveToken(this.token);
          this.service.addPerfilToLocalCache((response.body)!);
          this.router.navigateByUrl('/menu');
          this.showLoading = false;
        },
        (errorResponse: HttpErrorResponse) => {
          this.sendErrorNotification(NotificationType.ERROR, errorResponse.error.message);
          this.showLoading = false;
        }
      )
    );
  }
  sendErrorNotification(notificationType: NotificationType, message: string) {
    if(message){
      this.notificationService.notify(notificationType,message);
    } else {
      this.notificationService.notify(notificationType, 'Um erro ocorreu durante a operação.');
    }
  }
    viewPass(){
      this.visible = !this.visible;
      this.changetype = !this.changetype;
  }
}
