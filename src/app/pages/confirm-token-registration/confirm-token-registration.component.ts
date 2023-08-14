import { Component, OnInit } from '@angular/core';
import { Perfil } from '../model/perfil';
import { Subscription } from 'rxjs';
import { Router } from '@angular/router';
import { AuthenticationService } from 'src/app/services/authethication.service';
import { LoginperfilService } from 'src/app/services/loginperfil.service';
import { HttpErrorResponse } from '@angular/common/http';

@Component({
  selector: 'app-confirm-token-registration',
  templateUrl: './confirm-token-registration.component.html',
  styleUrls: ['./confirm-token-registration.component.css']
})
export class ConfirmTokenRegistrationComponent implements OnInit {
  perfis: Perfil [] = [];
  newPerfil: Perfil= new Perfil();
  showScreen!: boolean;
  showScreen2! :boolean;
  showScreen3! :boolean;
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
    this.showScreen = true;
  }
  perfil = this.authservice.getPerfilFromLocalCache();

  goToLogin(){
    this.router.navigate(['/login']);
  }
  ativarConta(): void{
    this.newPerfil = this.perfil;
    this.showLoading = true;
    this.subscriptions.push(
    this.authservice.activatePerfil(this.newPerfil).subscribe(
      (response: Perfil) => {
        this.showLoading = false;
        this.showScreen2 = true;
        this.showScreen = false;
      },
      (errorResponse: HttpErrorResponse) => {
        this.showScreen = false;
        this.showLoading = false;
        this.showScreen3 = true;
      }
    )
  );
}
  }
