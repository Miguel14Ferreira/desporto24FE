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
  token: any;
  subscriptions: Subscription[] = [];
  id!:number;
  perfil!:Perfil;
  editPerfil:Perfil = new Perfil();
  fileName!: string;
  profileImage!: File;
  constructor(private loginPerfilService: LoginperfilService,private authenticationService:AuthenticationService) { }
  url = './assets/foto .png';

  ngOnInit(): void {
    this.perfil = this.authenticationService.getPerfilFromLocalCache();
    this.loginPerfilService.obterInfo(this.perfil).subscribe( data => {
      this.perfil = data;
    }, error => console.log());
  }
  
  onSelectedFile(e:any){
    if(e.target.files){
      var reader = new FileReader();
      reader.readAsDataURL(e.target.files[0]);
      reader.onload=(event:any)=>{
        this.url=event.target.result;
      }
    }
  }
  NomeUtilizador(){
    return this.perfil.username;
  }


    igualInfo(perfil:Perfil, perfilNovo: Perfil){
      if(perfil == perfilNovo){
        alert(`A informação que estás a colocar é identica à que tu tens de momento.`);
      } else {
        alert(`Informação guardada com sucesso!`);
      }
    }

    onSubmit(): void{
      this.igualInfo(this.perfil, this.editPerfil);
      this.onUpdatePerfil2(this.editPerfil);
    }

    onUpdatePerfil(username: string, perfil: Perfil): void {
      const formData = this.loginPerfilService.updatePerfilFormData(username, perfil);
      this.subscriptions.push(
        this.loginPerfilService.updatePerfil(formData).subscribe(
          (response: Perfil) => {
            alert(`O teu perfil foi atualizado com sucesso.`);
          },
          (errorResponse: HttpErrorResponse) => {
            alert(`Ocurreu um erro`);
          }
        )
        );
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
