import { Component, OnInit } from '@angular/core';
import { Perfil } from '../model/perfil';
import { Subscription } from 'rxjs';
import { Router } from '@angular/router';
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
  perfis: Perfil [] = [];
  newPerfil: Perfil = new Perfil();
  changetype:boolean = true;
  visible:boolean = true;
  hidden:boolean = true;
  username!: string;
  password!: string;
  showLoading!: boolean;
  token: any;
  fileName!: string;
  profileImage!: File;
  response: any = null;
  subscriptions: Subscription[] = [];
  constructor(private router:Router,  private authservice:AuthenticationService, private loginService:LoginperfilService) {}

  ngOnInit(): void {
  }
  perfil = this.authservice.getPerfilFromLocalCache();

  goToLogin(){
    this.router.navigate(['/login']);
    this.authservice.logOut();
  }
  public reset(perfil: Perfil): void {
    if (perfil.password != perfil.confirmPassword){
      alert(`As tuas palavras-passes não estão iguais`)
    } else {
    perfil.username = this.perfil.username;
    this.showLoading = true;
    this.subscriptions.push(
      this.authservice.resetPassword(perfil).subscribe(
        (response: Perfil) => {
          this.showLoading = false;
          alert(`A tua palavra passe foi alterada com sucesso.`);
        },
        (errorResponse: HttpErrorResponse) => {
          alert(`Ocorreu um erro`);
          this.showLoading = false;
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
