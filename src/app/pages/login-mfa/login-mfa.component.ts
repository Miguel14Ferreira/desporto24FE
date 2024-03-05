import { Component } from '@angular/core';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { LoginperfilService } from 'src/app/services/loginperfil.service';
import { Perfil } from '../model/perfil';
import { Subscription } from 'rxjs';
import { HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { AuthenticationService } from 'src/app/services/authethication.service';
import { Token } from '../model/token';
import { HeaderType } from 'src/app/enum/header-type.enum';
import { NotificationService } from 'src/app/notifier.service';
import { CustomHttpResponse } from '../custom-http-response';

@Component({
  selector: 'app-login-mfa',
  templateUrl: './login-mfa.component.html',
  styleUrls: ['./login-mfa.component.css']
})
export class LoginMFAComponent {

  dark!:boolean;
  username!:any;
  token!:any;
  perfil!:Perfil;
  token2:Token = new Token();
  subscriptions:Subscription[] = [];
  showLoading!:boolean;
  showLoading2!:boolean;
  private readonly USERNAME: string = "username";
  loginError:boolean =false;
  errorMessage!:string;
  registerSuccess:boolean =false;
  successMessage!:any;
  validation1!:boolean;
  validation!:string;
  constructor(private activatedRoute:ActivatedRoute, private loginPerfilService:LoginperfilService,private authService:AuthenticationService,private router:Router,private notificationService:NotificationService) { }

  ngOnInit(): void {
    this.showLoading = false;
    var theme = localStorage.getItem('theme');
    if (theme == 'claro'){
      this.dark = false
    } else {
      this.dark = true
    }
    this.activatedRoute.paramMap.subscribe(
      (params: ParamMap) => {
        this.username = params.get(this.USERNAME);
      }
      )
      this.loginPerfilService.obterUserPeloUsername1(this.username).subscribe( data => {
        this.perfil = data;
      }, error => console.log());
  }
  confirmCode(token:Token){
    if (token.token == ""){
      this.loginError = false;
      this.validation1 = true;
      this.validation = "Ainda tens espaços em branco!"
    } else {
    this.showLoading = true;
    this.subscriptions.push(
      this.authService.confirmMFA(token.token).subscribe(
        () => {
        this.token = localStorage.getItem('tokenMFA')
        this.authService.saveToken(this.token);
        this.router.navigateByUrl('/menu');
        this.showLoading = false;
        },
        (errorResponse: HttpErrorResponse) => {
          this.errorMessage = errorResponse.error.message;
          this.showLoading = false;
          this.loginError = true;
          this.authService.logOut2();
          }
    )
  )}
        }

close(){
  this.loginError = false;
}
  sendSMS(){
    this.showLoading2 = true;
    this.subscriptions.push(
      this.authService.resendMFA(this.perfil.username).subscribe(
        (response: HttpResponse<CustomHttpResponse>) => {
          this.showLoading2 = false;
          this.registerSuccess = true;
          this.successMessage = response.body?.message;
        },
        (errorResponse: HttpErrorResponse) => {
          this.showLoading2 = false;
          this.loginError = true;
          this.errorMessage = errorResponse.error.message;
        }
      )
    )
  }
  remover(){
        this.router.navigate(['login']);
        this.authService.logOut2();
      }   
closeError(){
  this.loginError = false;
}
closeValidation(){
  this.validation1 = false;
}
closeSuccess(){
  this.registerSuccess = false;
}
}
