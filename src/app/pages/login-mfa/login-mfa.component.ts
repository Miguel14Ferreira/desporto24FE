import { Component } from '@angular/core';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { LoginperfilService } from 'src/app/services/loginperfil.service';
import { Perfil } from '../model/perfil';
import { Subscription } from 'rxjs';
import { HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { AuthenticationService } from 'src/app/services/authethication.service';
import { Token } from '../model/token';
import { HeaderType } from 'src/app/enum/header-type.enum';

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
  private readonly USERNAME: string = "username";
  constructor(private activatedRoute:ActivatedRoute, private loginPerfilService:LoginperfilService,private authService:AuthenticationService,private router:Router) { }

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
      if(this.authService.isLoggedIn()){
        this.router.navigateByUrl('/menu/'+this.perfil.username+'/');
      } else {
        this.router.navigateByUrl('/login');
      }
  }
  confirmCode(){
    this.showLoading = true;
    this.subscriptions.push(
      this.authService.confirmMFA(this.token2.token).subscribe(
        (response: HttpResponse<Token>) => {
        this.token = response.headers.get(HeaderType.JWT_TOKEN);
        this.authService.saveToken(this.token);
        this.router.navigateByUrl('/menu/'+this.perfil.username+'/');
        this.showLoading = false;
        },
        (errorResponse: HttpErrorResponse) => {
          this.showLoading = false;
          console.log(errorResponse);
        }
      )
    )
  }
  sendSMS(){
    this.showLoading = true;
    this.subscriptions.push(
      this.authService.resendMFA(this.perfil.username).subscribe(
        (response: Perfil) => {
          this.showLoading = false;
        },
        (errorResponse: HttpErrorResponse) => {
          this.showLoading = false;
        }
      )
    )
  }
  remover(){
        this.router.navigate(['login']);
}   

}
