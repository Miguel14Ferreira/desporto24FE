import { HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { HeaderType } from 'src/app/enum/header-type.enum';
import { NotificationType } from 'src/app/enum/notification-type.enum';
import { AuthenticationService } from 'src/app/services/authethication.service';
import { NotificationService } from 'src/app/services/notification.service';
import { Perfil } from '../model/perfil';
import { LoginperfilService } from 'src/app/services/loginperfil.service';
import { LoginMFAComponent } from '../login-mfa/login-mfa.component';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit, OnDestroy {
  perfil = new Perfil();
  loggedPerfil!:Perfil;
  username!: string;
  password!: string;
  visible:boolean = true;
  changetype:boolean = true;
  showLoading!: boolean;
  token: any;
  refreshtoken: any;
  response: any = null;
  dark!:boolean;
  showMFA: boolean = false;
  subscriptions: Subscription[] = [];
  constructor(private router:Router, private authenticationService:AuthenticationService, private loginPerfilService:LoginperfilService) { }
  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  ngOnInit(): void {
    this.authenticationService.isLoggedIn3()
    var theme = localStorage.getItem('theme');
    if (theme == 'claro'){
      this.dark = false
    } else {
      this.dark = true
    }
  }
  minhaImagem = "assets/Sports1.jpg";
  minhaImagem2 = "assets/olho1.png";
  minhaImagem3 = "assets/olho2.png";

 
onLogin(perfil: Perfil): void {
  if (perfil.username == "" || perfil.password == ""){
    alert(`Terás de preencher os espaços!`)
  } else {
  this.showLoading = true;
  this.subscriptions.push(
    this.authenticationService.loginPerfil(perfil).subscribe(
      (response: HttpResponse<Perfil>) => {
        if (response.body?.mfa == true){
          this.router.navigateByUrl('/login/MFAauthentication/'+perfil.username);
          this.showLoading = false;
          this.token = response.headers.get(HeaderType.JWT_TOKEN);
          localStorage.setItem('tokenMFA',this.token);
        } else {
        this.token = response.headers.get(HeaderType.JWT_TOKEN);
        this.authenticationService.saveToken(this.token);
        this.router.navigateByUrl('/menu');
        this.showLoading = false;
      }
    },
      (errorResponse: HttpErrorResponse) => {
          alert(`${errorResponse.error.message}`)
          this.showLoading = false;
          }
    )
  )}
}
  
    viewPass(){
      this.visible = !this.visible;
      this.changetype = !this.changetype;
  }
}
