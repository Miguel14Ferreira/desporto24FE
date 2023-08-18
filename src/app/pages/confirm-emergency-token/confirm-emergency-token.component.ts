import { Component } from '@angular/core';
import { Perfil } from '../model/perfil';
import { LoginperfilService } from 'src/app/services/loginperfil.service';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthenticationService } from 'src/app/services/authethication.service';

@Component({
  selector: 'app-confirm-emergency-token',
  templateUrl: './confirm-emergency-token.component.html',
  styleUrls: ['./confirm-emergency-token.component.css']
})
export class ConfirmEmergencyTokenComponent {

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
  bloquearConta(): void{
    this.newPerfil = this.perfil;
    this.showLoading = true;
    this.subscriptions.push(
    this.authservice.deactivatePerfil(this.newPerfil).subscribe(
      (response: Perfil) => {
        this.showLoading = false;
        this.showScreen2 = true;
        this.showScreen = false;
        this.authservice.logOut();
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
