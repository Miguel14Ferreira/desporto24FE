import { Component, OnInit } from '@angular/core';
import { Perfil } from '../model/perfil';
import { Subscription } from 'rxjs';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { LoginperfilService } from 'src/app/services/loginperfil.service';
import { AuthenticationService } from 'src/app/services/authethication.service';
import { HttpErrorResponse } from '@angular/common/http';
import { NgForm } from '@angular/forms';

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
      }
      )
  }

  goToLogin(){
    this.router.navigate(['/login']);
  }
  public reset(perfil: Perfil): void {
    if (perfil.password == null || perfil.confirmPassword == null){
      alert(`Ainda tens espaços em branco`)
    } else {
    if (perfil.password != perfil.confirmPassword){
      alert(`As tuas palavras-passes não estão iguais`)
    } else {
    this.showLoading = true;
    this.subscriptions.push(
      this.authservice.resetPassword(this.token,perfil).subscribe(
        (response) => {
          this.showLoading = false;
          alert(`A tua palavra passe foi alterada com sucesso.`);
        },
        (errorResponse: HttpErrorResponse) => {
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
