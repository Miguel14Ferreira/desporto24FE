import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthenticationService } from 'src/app/services/authethication.service';
import { Perfil } from '../model/perfil';
import { HttpErrorResponse } from '@angular/common/http';
import { LoginperfilService } from 'src/app/services/loginperfil.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-menu',
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.css']
})
export class MenuComponent implements OnInit {
  public perfis : Perfil [] = [];
  fileName!: string;
  profileImage!: File;
  url:any;
  changetype:boolean = true;
  visible:boolean = true;
  username!: string;
  password!: string;
  showLoading!: boolean;
  showImage!: boolean;
  token: any;
  subscriptions: Subscription[] = [];
  id!:number;
  editPerfil:Perfil = new Perfil();
  constructor(private authenticationService:AuthenticationService,private router:Router,private loginPerfilService: LoginperfilService) { }


  ngOnInit(): void {
    this.showImage = true;
  }
  perfil = this.authenticationService.getPerfilFromLocalCache();

  NomeUtilizador(){
    return this.perfil.username;
  }
 
  alterarDados(){
    this.router.navigate(['menu/alterardados']);
  }
  alterarPassword(){
    this.router.navigate(['menu/alterarPassword']);
  }
  Utilizadores(){
    this.router.navigate(['menu/perfis']);
  }
  remover(){
    this.authenticationService.logOut();
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


public atualizarFoto(){
  if (this.profileImage == null){
    alert(`Por favor coloca uma nova foto para fazermos a alteração.`)
  } else {
  const formData = this.loginPerfilService.updatePerfilFoto(this.perfil.username, this.profileImage);
        this.showLoading = true;
        this.subscriptions.push(
          this.authenticationService.updatePerfilFoto(formData).subscribe(
            (response: Perfil) => {
              this.showLoading = false;
              alert(`A tua foto de perfil foi atualizada com sucesso.`);
            },
            (errorResponse: HttpErrorResponse) => {
              alert(`Ocorreu um erro`);
              this.showLoading = false;
            }
          )
        );
      }
    }
    }
