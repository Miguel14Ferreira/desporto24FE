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
  subscriptions: Subscription[] = [];
  constructor(private router:Router,  private authservice:AuthenticationService, private loginService:LoginperfilService) {}
  url = './assets/avatar.jpg';
  /*saveNewUser(){
    this.authservice.createPerfil(this.perfil).subscribe( data =>{
      alert("Enviámos um mail para o teu email para ativares a tua conta.")
      this.router.navigate(['/login']);
    },
    error => console.log(error));
  }

  onSubmit(){
    if (this.perfil.password != this.perfil.confirmPassword){
      (errorResponse: HttpErrorResponse) => {
       alert("As tuas palavras-passe estão diferentes.")
      }
    } else {
      this.onRegister(this.perfil);
    }
  }
  */
  
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
        this.showLoading = false;
        console.log(response);
        this.authservice.addPerfilToLocalCache((response)!);
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

public onRegister2(perfil: Perfil): void {
  if (perfil.password != perfil.confirmPassword){
    alert(`As tuas palavras-passes não estão iguais`)
  } else if (perfil.gender == ""){
    alert(`Não escolheste nenhum género!`)
  } else {
  this.showLoading = true;
  this.subscriptions.push(
    this.authservice.createPerfil2(perfil).subscribe(
      (response: Perfil) => {
        this.showLoading = false;
        this.authservice.addPerfilToLocalCache((perfil)!);
        alert(`Foi enviado um email para ${perfil.email} para concluir o registo, só depois da confirmação do email será possível efetuar o login no site.`);
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