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
  url = './assets/foto .png';
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
    var reader = new FileReader();
    reader.readAsDataURL(e.target.files[0]);
    reader.onload=(event:any)=>{
      this.url=event.target.result;
}
}



public onRegister(perfilForm: NgForm): void {
  const formData = this.loginService.createPerfilFormData(perfilForm.value, this.profileImage);
  console.log(this.profileImage)
  this.showLoading = true;
  this.subscriptions.push(
    this.authservice.createPerfil(formData).subscribe(
      (response: Perfil) => {
        this.showLoading = false;
        alert(`Foi enviado um email para ${response.email} para concluir o registo, só depois da confirmação do email será possível efetuar o login no site.`);
        this.router.navigate(['/login']);
      },
      (errorResponse: HttpErrorResponse) => {
        alert(`Ocorreu um erro`);
        this.showLoading = false;
      }
    )
  );
}

public onRegister2(perfil: Perfil): void {
  this.showLoading = true;
  this.subscriptions.push(
    this.authservice.createPerfil2(perfil).subscribe(
      (response: Perfil) => {
        this.showLoading = false;
        alert(`Foi enviado um email para ${response.email} para concluir o registo, só depois da confirmação do email será possível efetuar o login no site.`);
        this.router.navigate(['/login']);
      },
      (errorResponse: HttpErrorResponse) => {
        alert(`Ocorreu um erro`);
        this.showLoading = false;
      }
    )
  );
}
}