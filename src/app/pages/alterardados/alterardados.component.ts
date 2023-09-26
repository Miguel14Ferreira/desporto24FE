import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormBuilder, NgForm } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { NotificationType } from 'src/app/enum/notification-type.enum';
import { AuthenticationService } from 'src/app/services/authethication.service';
import { NotificationService } from 'src/app/services/notification.service';
import { AuthService } from 'src/auth.service';
import { LoginperfilService } from '../../services/loginperfil.service';
import { Perfil } from '../model/perfil';

@Component({
  selector: 'app-alterardados',
  templateUrl: './alterardados.component.html',
  styleUrls: ['./alterardados.component.css']
})
export class AlterardadosComponent implements OnInit {
  changetype:boolean = true;
  visible:boolean = true;
  username!: string;
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
  constructor(private loginPerfilService: LoginperfilService,private authenticationService:AuthenticationService) { }
  url:any;

  ngOnInit(): void {
    this.perfil = this.authenticationService.getPerfilFromLocalCache();
    this.loginPerfilService.obterInfo(this.perfil).subscribe( data => {
      this.perfil = data;
    }, error => console.log());
    this.showImage = true;
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

    onUpdatePerfil(): void {
      if (this.editPerfil.address== "" || this.editPerfil.dateOfBirth== "" || this.editPerfil.email== "" || this.editPerfil.desportosFavoritos== "" || this.editPerfil.fullName== "" ||
      this.editPerfil.country== "" || this.editPerfil.location== "" || this.editPerfil.postalCode== "" || this.editPerfil.phone== "" || this.editPerfil.indicativePhone== "" ){
        alert(`Ainda tens espaços em branco!`)
      } else if (this.editPerfil.gender == ""){
          alert(`Não escolheste nenhum género!`)
        } else {
        const formData = this.loginPerfilService.updatePerfilFormData(this.perfil.username, this.editPerfil, this.profileImage);
        this.showLoading = true;
        this.subscriptions.push(
          this.loginPerfilService.updatePerfil(formData).subscribe(
            (response: Perfil) => {
              localStorage.removeItem('Perfil');
              this.authenticationService.addPerfilToLocalCache((response)!);
              this.showLoading = false;
              alert(`A tua informação de perfil foi atualizada com sucesso.`);
            },
            (errorResponse: HttpErrorResponse) => {
              alert(`Ocorreu um erro`);
              this.showLoading = false;
            }
          )
        );
      }
    }

    onUpdatePerfil2(perfil: Perfil): void {
      perfil.username = this.perfil.username
      this.showLoading = true;
      this.subscriptions.push(
        this.loginPerfilService.updatePerfil2(perfil).subscribe(
          (response: Perfil) => {
            this.showLoading = false;
            alert(`O teu perfil foi atualizado com sucesso.`);
          },
          (errorResponse: HttpErrorResponse) => {
            alert(`Ocurreu um erro`);
          }
        )
        );
    }
  }