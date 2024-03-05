import { HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { NotificationType } from 'src/app/enum/notification-type.enum';
import { AuthService } from 'src/auth.service';
import { LoginperfilService } from '../../services/loginperfil.service';
import { Perfil } from '../model/perfil';
import { Subscription } from 'rxjs';
import { AuthenticationService } from 'src/app/services/authethication.service';
import { CustomHttpResponse } from '../custom-http-response';

@Component({
  selector: 'app-changepassword',
  templateUrl: './changepassword.component.html',
  styleUrls: ['./changepassword.component.css']
})
export class ChangepasswordComponent implements OnInit {
  changetype:boolean = true;
  visible:boolean = true;
  username!: any;
  password!: string;
  showLoading!: boolean;
  showLoading2!: boolean;
  token: any;
  subscriptions: Subscription[] = [];
  id!:number;
  perfil!:Perfil;
  editperfil:Perfil = new Perfil();
  fileName!: any;
  dark!:boolean;
  registerError:boolean =false;
  errorMessage!:string;
  registerSuccess:boolean =false;
  successMessage!:any;
  validation1!:boolean;
  validation!:string;
  private readonly USERNAME:string = "username";
  
  constructor(private loginPerfilService: LoginperfilService,private router:Router, private formBuilder: FormBuilder,private route:ActivatedRoute,private activatedRoute:ActivatedRoute,private authenticationService:AuthenticationService,private authService:AuthService) { }

  ngOnInit(): void {
    this.loginPerfilService.obterUserPeloUsername1(this.authenticationService.loggedInPerfilname).subscribe( data => {
      this.perfil = data;
    }, error => console.log());
    var theme = localStorage.getItem('theme');
    if (theme == 'claro'){
      this.dark = false
    } else {
      this.dark = true
    }
  }
  Menu(){
    this.router.navigate([`menu`]);
  }

  viewPass(){
    this.visible = !this.visible;
    this.changetype = !this.changetype;
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

  
  onUpdatePerfilPassword(): void {
    if (this.editperfil.newUsername == "" || this.editperfil.password == "" || this.editperfil.confirmPassword == ""){
      this.validation1 = true;
      this.validation = `Ainda tens espaços em branco`;
    } else if (this.editperfil.password != this.editperfil.confirmPassword){
      this.validation1 = true;
    this.validation =`As tuas palavras-passes não estão iguais`;
    } else {
      this.showLoading = true;
    const formData = this.loginPerfilService.updatePerfilPasswordFormData(this.perfil.username, this.editperfil);
    this.subscriptions.push(
      this.loginPerfilService.updatePerfilPassword(formData).subscribe(
        (response: HttpResponse<CustomHttpResponse>) => {
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
