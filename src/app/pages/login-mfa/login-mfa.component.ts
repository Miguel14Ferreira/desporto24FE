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
  showLoading2!:boolean;
  showLoading3!:boolean;
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
  }
  confirmCode(){
    this.showLoading = true;
    this.subscriptions.push(
      this.authService.confirmMFA(this.token2.token).subscribe(
        (response: HttpResponse<Perfil>) => {
        this.token = localStorage.getItem('tokenMFA')
        this.authService.saveToken(this.token);
        this.router.navigateByUrl('/menu');
        this.showLoading = false;
        localStorage.removeItem('tokenMFA');
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
          this.showLoading2 = false;
        },
        (errorResponse: HttpErrorResponse) => {
          this.showLoading2 = false;
        }
      )
    )
  }
  remover(){
        this.router.navigate(['login']);
        localStorage.removeItem('tokenMFA');
}   

}
