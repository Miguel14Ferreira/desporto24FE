import { Component, OnDestroy, OnInit } from '@angular/core';
import { Perfil } from '../model/perfil';
import { Router } from '@angular/router';
import { HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { AuthenticationService } from 'src/app/services/authethication.service';
import { LoginperfilService } from 'src/app/services/loginperfil.service';
import { NgForm } from '@angular/forms';

@Component({
  selector: 'app-createaccount',
  templateUrl: './createaccount.component.html',
  styleUrls: ['./createaccount.component.css']
})
export class CreateaccountComponent implements OnInit, OnDestroy {
  perfil:Perfil = new Perfil();
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
  constructor(private router:Router,  private authservice:AuthenticationService, private loginService:LoginperfilService) {}
  url = './assets/avatar.jpg';
  
viewPass(){
    this.visible = !this.visible;
    this.changetype = !this.changetype;
}
ngOnDestroy(): void {
  this.subscriptions.forEach(sub => sub.unsubscribe());
}

ngOnInit(): void {
  if(this.authservice.isLoggedIn()){
    this.router.navigateByUrl('/menu');
  }
  var theme = localStorage.getItem('theme');
    if (theme == 'claro'){
      this.dark = false
    } else {
      this.dark = true
    }
}

public onProfileImageChange(e: any) {
  if(e.target.files){
  this.fileName = e.target.files[0].name;    
  this.profileImage = e.target.files[0];
    var reader = new FileReader();
    reader.readAsDataURL(e.target.files[0]);
    reader.onload=(event:any)=>{
      this.url=event.target.result;
    }
} 
}

public onProfileImageChange2(e: any) {
  if(e.target.files){
    this.fileName = e.target.files[0].name;    
    this.profileImage = e.target.files[0];
    var reader = new FileReader();
    reader.readAsDataURL(e.target.files[0]);
    reader.onload=(event:any)=>{
      this.url=event.target.result;
}
  }
}



public onRegister(): void {
  if (this.perfil.username== "" || this.perfil.address== "" || this.perfil.confirmPassword== "" || this.perfil.dateOfBirth== "" || this.perfil.email== "" || this.perfil.desportosFavoritos== "" || this.perfil.fullName== "" ||
    this.perfil.country== "" || this.perfil.location== "" || this.perfil.postalCode== "" || this.perfil.phone== "" || this.perfil.indicativePhone== "" || this.perfil.password == ""){
      alert(`Ainda tens espaços em branco!`)
  } else if (this.perfil.password != this.perfil.confirmPassword){
    alert(`As tuas palavras-passes não estão iguais`)
  } else if (this.perfil.gender == ""){
    alert(`Não escolheste nenhum género!`)
  } else {
  const formData = this.loginService.createPerfilFormData(this.perfil, this.profileImage);
  this.showLoading = true;
  this.subscriptions.push(
    this.authservice.createPerfil(formData).subscribe(
      (response: Perfil) => {
        console.log(response);
        this.showLoading = false;
        alert(`Foi enviado um email para ${response.email} para concluir o registo, só depois da confirmação do email será possível efetuar o login no site.`);
      },
      (errorResponse: HttpErrorResponse) => {
        if(errorResponse.error instanceof ErrorEvent){
          alert(`Ocorreu um erro - ${errorResponse.error.message}`)
          this.showLoading = false;
        } else {
          if(errorResponse.error.reason){
            alert (errorResponse.error.reason);
            console.log(errorResponse);
            this.showLoading = false;
          } else {
            alert (`Um erro aplicacional ocorreu ${errorResponse.status}`)
            this.showLoading = false;
          }
        }
      }
    )
  );
}
}

/*
public onRegister2(): void {
  if (this.perfil.username== "" || this.perfil.address== "" || this.perfil.confirmPassword== "" || this.perfil.dateOfBirth== "" || this.perfil.email== "" || this.perfil.desportosFavoritos== "" || this.perfil.fullName== "" ||
    this.perfil.country== "" || this.perfil.location== "" || this.perfil.postalCode== "" || this.perfil.phone== "" || this.perfil.indicativePhone== "" || this.perfil.password == ""){
      alert(`Ainda tens espaços em branco!`)
  } else if (this.perfil.password != this.perfil.confirmPassword){
    alert(`As tuas palavras-passes não estão iguais`)
  } else if (this.perfil.gender == ""){
    alert(`Não escolheste nenhum género!`)
  } else {
  const formData = this.loginService.createPerfilFormData(this.perfil, this.profileImage);
  this.showLoading = true;
  this.subscriptions.push(
    this.authservice.createPerfil(formData).subscribe(
      (response: Perfil) => {
        this.showLoading = false;
        this.authservice.addPerfilToLocalCache2((response.email)!);
        alert(`Foi enviado um email para ${response.email} para concluir o registo, só depois da confirmação do email será possível efetuar o login no site.`);
      },
      (errorResponse: HttpErrorResponse) => {
        alert(`Ocorreu um erro`);
        this.showLoading = false;
      }
    )
  );
}
}
*/
}