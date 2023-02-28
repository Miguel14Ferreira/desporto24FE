import { Component, OnDestroy, OnInit } from '@angular/core';
import { Perfil } from '../model/perfil';
import { LoginperfilService } from '../../services/loginperfil.service';
import { Router } from '@angular/router';
import { Form, FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { NotificationType } from 'src/app/enum/notification-type.enum';
import { HttpErrorResponse, HttpResponse } from '@angular/common/http';
import { NotificationService } from 'src/app/services/notification.service';
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
  username!: string;
  password!: string;
  showLoading!: boolean;
  token: any;
  response: any = null;
  subscriptions: Subscription[] = [];
  constructor(private service: LoginperfilService,private router:Router, private formBuilder: FormBuilder, private notificationType:NotificationType, private errorResponse:HttpErrorResponse, private notificationService: NotificationService,  private authservice:AuthenticationService) {}
  minhaImagem = './assets/lr .jpg';
  url = './assets/foto .png';
  saveNewUser(){
    this.authservice.createPerfil(this.perfil).subscribe( data =>{
      console.log("Enviámos um mail para o teu email para ativares a tua conta.")
      this.router.navigate(['/login']);
    },
    error => console.log(error));
  }

  onSubmit(){
    if (this.perfil.password != this.perfil.confirmPassword){
      (errorResponse: HttpErrorResponse) => {
        this.sendNotification(NotificationType.INFO, `As tuas palavras-passe estão diferentes.`);
      }
    } else {
      this.onRegister(this.perfil);
    }
  }

sendNotification(notificationType: NotificationType, message: string) {
  if(message){
    this.notificationService.notify(notificationType,message);
  } else {
    this.notificationService.notify(notificationType, 'Ocorreu um erro, por favor tenta novamente.');
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
onRegister(perfil: Perfil): void {
  this.showLoading = true;
  this.subscriptions.push(
    this.authservice.createPerfil(perfil).subscribe(
      (response: Perfil) => {
        this.showLoading = false;
        this.sendNotification(NotificationType.SUCESS, `A tua conta foi criada ${response.username}! Pedimos agora que te dirijas ao teu email para confirmares o registo da nova tua conta!`);
      },
      (errorResponse: HttpErrorResponse) => {
        this.sendNotification(NotificationType.ERROR, errorResponse.error.message);
        this.showLoading = false;
      }
    )
  );
}
}