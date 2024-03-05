import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthenticationService } from 'src/app/services/authethication.service';
import { LoginperfilService } from 'src/app/services/loginperfil.service';
import { Perfil } from '../model/perfil';
import { HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { CustomHttpResponse } from '../custom-http-response';

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
  dark!:boolean;
  subscriptions: Subscription[] = [];
  registerError:boolean =false;
  errorMessage!:string;
  registerSuccess:boolean =false;
  successMessage!:any;
  validation1!:boolean;
  validation!:string;
  constructor(private router:Router,  private authservice:AuthenticationService, private loginService:LoginperfilService) {}

  ngOnInit(): void {
    var theme = localStorage.getItem('theme');
    if (theme == 'claro'){
      this.dark = false
    } else {
      this.dark = true
    }
  }
  goToLogin(){
    this.router.navigate(['/login']);
  }
  public sendEmail(perfil: Perfil): void {
    if(perfil.email == ""){
      this.validation1 = true;
      this.validation = `Ainda tens espaços em branco`;
    } else {
    this.showLoading = true;
    this.subscriptions.push(
      this.authservice.sendEmail(perfil).subscribe(
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
closeError(){
  this.registerError = false;
}
closeSuccess(){
  this.registerSuccess = false;
}
closeValidation(){
  this.validation1 = false;
}
}
