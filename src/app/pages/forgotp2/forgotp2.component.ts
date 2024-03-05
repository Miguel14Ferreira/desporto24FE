import { Component, OnInit } from '@angular/core';
import { Perfil } from '../model/perfil';
import { Subscription } from 'rxjs';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { LoginperfilService } from 'src/app/services/loginperfil.service';
import { AuthenticationService } from 'src/app/services/authethication.service';
import { HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { NotificationService } from 'src/app/notifier.service';
import { CustomHttpResponse } from '../custom-http-response';

@Component({
  selector: 'app-forgotp2',
  templateUrl: './forgotp2.component.html',
  styleUrls: ['./forgotp2.component.css']
})
export class Forgotp2Component implements OnInit {
  newPerfil: Perfil = new Perfil();
  changetype:boolean = true;
  visible:boolean = true;
  hidden:boolean = true;
  perfil!:Perfil;
  username!: any;
  password!: string;
  showLoading!: boolean;
  token: any;
  fileName!: string;
  profileImage!: File;
  dark!: boolean;
  response: any = null;
  subscriptions: Subscription[] = [];
  private readonly ACCOUNT_TOKEN = 'token';
  private readonly USERNAME = 'username';
  registerError:boolean =false;
  errorMessage!:string;
  registerSuccess:boolean =false;
  successMessage!:any;
  validation1!:boolean;
  validation!:string;
  constructor(private activatedRoute: ActivatedRoute,private router:Router,  private authservice:AuthenticationService, private loginService:LoginperfilService,private notificationService:NotificationService) {}

  ngOnInit(): void {
    this.authservice.logOut();
    var theme = localStorage.getItem('theme');
    if (theme == 'claro'){
      this.dark = false
    } else {
      this.dark = true
    }
    this.activatedRoute.paramMap.subscribe(
      (params: ParamMap) => {
        this.token = params.get(this.ACCOUNT_TOKEN);
        this.username = params.get(this.USERNAME);
      }
      )
      this.loginService.obterUserPeloUsername1(this.username).subscribe( data => {
        this.perfil = data;
      }, error => console.log());
  }

  goToLogin(){
    this.router.navigate(['/login']);
  }
  public reset(perfil: Perfil): void {
    if (perfil.password == "" || perfil.confirmPassword == ""){
      this.validation1 = true;
      this.validation = `Ainda tens espaços em branco`;
    } else {
    if (perfil.password != perfil.confirmPassword){
      this.validation1 = true;
      this.validation = `As tuas palavras-passes não estão iguais`;
    } else {
    this.showLoading = true;
    this.subscriptions.push(
      this.authservice.resetPassword(this.token,perfil).subscribe(
        (response: HttpResponse<CustomHttpResponse>) => {
          this.showLoading = false;
          this.showLoading = false;
        this.registerSuccess = true;
        this.registerError = false;
        this.validation1 = false;
        this.successMessage = response.body?.message
        },
        (errorResponse: HttpErrorResponse) => {
          this.errorMessage = errorResponse.error.message;
          this.showLoading = false;
          this.registerError = true;
          this.registerSuccess = false;
          this.validation1 = false;
        }
      )
    );
  }
}
  }
  closeError(){
    this.registerError = false;
  }
  closeSuccess(){
    this.registerSuccess = false;
  }
  closeValidation(){
    this.validation1 = false;
  }


  viewPass(){
    this.visible = !this.visible;
    this.changetype = !this.changetype;
}
}
