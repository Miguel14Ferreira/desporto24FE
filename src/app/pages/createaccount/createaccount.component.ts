import { Component, OnDestroy, OnInit } from '@angular/core';
import { Perfil } from '../model/perfil';
import { LoginperfilService } from '../../services/loginperfil.service';
import { Router } from '@angular/router';
import { Form, FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { AuthenticationService } from 'src/app/services/authethication.service';

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
  response: any = null;
  subscriptions: Subscription[] = [];
  constructor(private router:Router, private formBuilder: FormBuilder,  private authservice:AuthenticationService) {}
  url = './assets/foto .png';
  saveNewUser(){
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

onSelectedFile(e:any){
  if(e.target.files){
    var reader = new FileReader();
    reader.readAsDataURL(e.target.files[0]);
    reader.onload=(event:any)=>{
      this.url=event.target.result;
    }
  }
}
public onRegister(user: Perfil): void {
  this.showLoading = true;
  this.subscriptions.push(
    this.authservice.createPerfil(user).subscribe(
      (response: Perfil) => {
        this.showLoading = false;
        alert(`Foi enviado um email para ${response.email} para concluir o registo, só depois da confirmação do email, será possível efetuar o login no site.`);
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