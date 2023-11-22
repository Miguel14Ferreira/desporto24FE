import { HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { HeaderType } from 'src/app/enum/header-type.enum';
import { NotificationType } from 'src/app/enum/notification-type.enum';
import { AuthenticationService } from 'src/app/services/authethication.service';
import { NotificationService } from 'src/app/services/notification.service';
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
  refreshtoken: any;
  response: any = null;
  dark!:boolean;
  showMFA: boolean = false;
  subscriptions: Subscription[] = [];
  constructor(private router:Router, private authenticationService:AuthenticationService) { }
  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  ngOnInit(): void {
    var theme = localStorage.getItem('theme');
    if (theme == 'claro'){
      this.dark = false
    } else {
      this.dark = true
    }
    this.authenticationService.isLoggedIn()
  }
  minhaImagem = "assets/Sports1.jpg";
  minhaImagem2 = "assets/olho1.png";
  minhaImagem3 = "assets/olho2.png";

  /*
  onLogin(perfil: Perfil): void {
    if (this.perfil.username == "" || this.perfil.password == ""){
      alert(`Terás de preencher os espaços!`)
    } else {
    this.showLoading = true;
    this.subscriptions.push(
      this.authenticationService.loginPerfil(perfil).subscribe(
        (response: HttpResponse<Perfil>) => {
          this.token = response.headers.get(HeaderType.JWT_TOKEN);
          this.authenticationService.saveToken(this.token);
          this.authenticationService.addPerfilToLocalCache((response.body)!);
          this.router.navigateByUrl('/menu');
          this.showLoading = false;
        },
        (errorResponse: HttpErrorResponse) => {
          alert("Ocorreu um erro a efetuar o login")
          this.showLoading = false;
        }
      )
    );
  }
}
*/
onLogin(perfil: Perfil): void {
  if (this.perfil.username == "" || this.perfil.password == ""){
    alert(`Terás de preencher os espaços!`)
  } else {
  this.showLoading = true;
  this.subscriptions.push(
    this.authenticationService.loginPerfil(perfil).subscribe(
      (response: HttpResponse<Perfil>) => {
        if (response.body?.mfa == true){
          this.router.navigateByUrl('/login/MFAauthentication/'+this.perfil.username);
          this.showLoading = false;
        } else {
        this.token = response.headers.get(HeaderType.JWT_TOKEN);
        this.authenticationService.saveToken(this.token);
        this.router.navigateByUrl('/menu/'+perfil.username);
        this.showLoading = false;
      }
    },
      (errorResponse: HttpErrorResponse) => {
        if(errorResponse.error instanceof ErrorEvent){
          alert(`Ocorreu um erro - ${errorResponse.error.message}`)
          this.showLoading = false;
        } else {
          if(errorResponse.error.reason){
            alert (errorResponse.error.reason);
            console.log(errorResponse);
            this.showLoading = false;
          } else {
            alert (`Um erro aplicacional ocorreu ${errorResponse.status}`)
            this.showLoading = false;
          }
        }
      }
    )
  );
}
}
  
    viewPass(){
      this.visible = !this.visible;
      this.changetype = !this.changetype;
  }
}
