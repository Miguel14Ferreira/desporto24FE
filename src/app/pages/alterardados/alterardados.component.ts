import { HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, NgForm } from '@angular/forms';
import { ActivatedRoute, ParamMap, Route, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { NotificationType } from 'src/app/enum/notification-type.enum';
import { AuthenticationService } from 'src/app/services/authethication.service';
import { AuthService } from 'src/auth.service';
import { LoginperfilService } from '../../services/loginperfil.service';
import { Perfil } from '../model/perfil';
import { CustomHttpResponse } from '../custom-http-response';

@Component({
  selector: 'app-alterardados',
  templateUrl: './alterardados.component.html',
  styleUrls: ['./alterardados.component.css']
})
export class AlterardadosComponent implements OnInit {
  changetype:boolean = true;
  visible:boolean = true;
  username!: any;
  password!: string;
  showLoading!: boolean;
  showImage!: boolean;
  showImage2!: boolean;
  token: any;
  subscriptions: Subscription[] = [];
  id!:number;
  perfil!:Perfil;
  editPerfil:Perfil = new Perfil();
  fileName!: string;
  profileImage!: File;
  dark!:boolean;
  private readonly USERNAME: string = "username";
  registerError:boolean =false;
  errorMessage!:string;
  registerSuccess:boolean =false;
  successMessage!:any;
  validation1!:boolean;
  validation!:string;
  constructor(private loginPerfilService: LoginperfilService,private authenticationService:AuthenticationService, private router:Router) { }
  url:any;

  ngOnInit(): void {
    this.loginPerfilService.obterUserPeloUsername1(this.authenticationService.loggedInPerfilname).subscribe( data => {
      this.perfil = data;
    }, error => console.log());
    this.showImage = true;
    var theme = localStorage.getItem('theme');
    if (theme == 'claro'){
      this.dark = false
    } else {
      this.dark = true
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

  verDadosPerfil(){
    this.router.navigate([`menu/dadosPerfil`]);
  }

  NomeUtilizador(){
    return this.perfil.username;
  }
  public onProfileImageChange(e: any) {
    if(e.target.files){
      this.showImage = false;
    this.fileName = e.target.files[0].name;    
    this.profileImage = e.target.files[0];
      var reader = new FileReader();
      reader.readAsDataURL(e.target.files[0]);
      reader.onload=(event:any)=>{
        this.url=event.target.result;
      }
    }
  }
  Menu(){
    this.router.navigate([`menu`]);
  }

    onUpdatePerfil(): void {
      if (this.editPerfil.address== "" || this.editPerfil.dateOfBirth== "" || this.editPerfil.email== "" || this.editPerfil.desportosFavoritos== "" || this.editPerfil.fullName== "" ||
      this.editPerfil.country== "" || this.editPerfil.location== "" || this.editPerfil.postalCode== "" || this.editPerfil.phone== "" || this.editPerfil.indicativePhone== "" ){
        this.validation1 = true;
      this.validation = `Ainda tens espaços em branco`;
      } else if (this.editPerfil.gender == ""){
        this.validation1 = true;
    this.validation =`Não escolheste nenhum género!`
        } else {
        const formData = this.loginPerfilService.updatePerfilFormData(this.perfil.username, this.editPerfil, this.profileImage);
        this.showLoading = true;
        this.subscriptions.push(
          this.loginPerfilService.updatePerfil(formData).subscribe(
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
