import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthenticationService } from 'src/app/services/authethication.service';
import { LoginperfilService } from 'src/app/services/loginperfil.service';
import { Perfil } from '../model/perfil';
import { HttpErrorResponse, HttpResponse } from '@angular/common/http';

@Component({
  selector: 'app-forgotp',
  templateUrl: './forgotp.component.html',
  styleUrls: ['./forgotp.component.css']
})
export class ForgotpComponent implements OnInit {
  perfil = new Perfil();
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
  goToLogin(){
    this.router.navigate(['/login']);
  }
  public sendEmail(perfil: Perfil): void {
    this.showLoading = true;
    this.subscriptions.push(
      this.authservice.sendEmail(perfil).subscribe(
        (response: HttpResponse<Perfil>) => {
          this.showLoading = false;
          this.authservice.addPerfilToLocalCache((response.body)!);
          alert(`Foi enviado um email para ${perfil.email} para efetuar o reset à tua password.`);
        },
        (errorResponse: HttpErrorResponse) => {
          alert(`Ocorreu um erro `);
          this.showLoading = false;
        }
      )
    );
  }
}
