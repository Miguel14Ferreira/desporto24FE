import { Component, OnInit } from '@angular/core';
import { Perfil } from '../model/perfil';
import { Subscription } from 'rxjs';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { LoginperfilService } from 'src/app/services/loginperfil.service';
import { AuthenticationService } from 'src/app/services/authethication.service';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-reset-pw-emergency',
  templateUrl: './reset-pw-emergency.component.html',
  styleUrls: ['./reset-pw-emergency.component.css']
})
export class ResetPwEmergencyComponent implements OnInit{
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
  subscriptions: Subscription[] = [];
  private readonly ACCOUNT_TOKEN = 'token';
  private readonly USERNAME = 'username';
  constructor(private activatedRoute: ActivatedRoute,private router:Router,  private authservice:AuthenticationService, private loginService:LoginperfilService) {}

  ngOnInit(): void {
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
      alert(`Ainda tens espaços em branco`)
    } else {
    if (perfil.password != perfil.confirmPassword){
      alert(`As tuas palavras-passes não estão iguais`)
    } else {
    this.showLoading = true;
    this.subscriptions.push(
      this.authservice.resetPasswordEmergency(this.token,this.username,perfil.password).subscribe(
        (response : Perfil) => {
          this.showLoading = false;
          alert(`A tua palavra passe foi alterada com sucesso, podes agora entrar na tua conta.`);
          this.router.navigate(['/login']);
        },
        (errorResponse: HttpErrorResponse) => {
          console.log(errorResponse);
          this.showLoading = false;
          alert(`Ocorreu um erro`);
        }
      )
    );
  }
}
  }


  viewPass(){
    this.visible = !this.visible;
    this.changetype = !this.changetype;
}
}
