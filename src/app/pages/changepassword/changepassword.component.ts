import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NotificationType } from 'src/app/enum/notification-type.enum';
import { AuthService } from 'src/auth.service';
import { LoginperfilService } from '../../services/loginperfil.service';
import { NotificationService } from 'src/app/services/notification.service';
import { Perfil } from '../model/perfil';
import { Subscription } from 'rxjs';
import { AuthenticationService } from 'src/app/services/authethication.service';

@Component({
  selector: 'app-changepassword',
  templateUrl: './changepassword.component.html',
  styleUrls: ['./changepassword.component.css']
})
export class ChangepasswordComponent implements OnInit {
  changetype:boolean = true;
  visible:boolean = true;
  username!: string;
  password!: string;
  showLoading!: boolean;
  token: any;
  subscriptions: Subscription[] = [];
  id!:number;
  perfil!:Perfil;
  public editPerfil = new Perfil();
  fileName!: any;
  constructor(private loginPerfilService: LoginperfilService,private router:Router, private formBuilder: FormBuilder,private route:ActivatedRoute,private authenticationService:AuthenticationService,private authService:AuthService) { }

  ngOnInit(): void {
    this.perfil = this.authenticationService.getPerfilFromLocalCache();
    this.loginPerfilService.obterInfo(this.perfil).subscribe( data => {
      this.perfil = data;
    }, error => console.log(error));
}
  minhaImagem = "./assets/ski .jpg";

  palavrasPassesDiferentes(novaPassword : string, novaConfirmPassword: string, password: string){
    if (novaPassword != novaConfirmPassword){
      alert( `A nova palavra-passe e a confirmação da nova palavra-passe tem de estar iguais!`);
    } else if (password == novaPassword){
      alert(`A presente palavra-passe que estás a colocar, já se encontra em uso.`)
    }
  }
  
  obterNomeUtilizador (){
    return this.perfil.username;
  }
  
  onUpdatePerfilPassword(): void {
    const formData = this.loginPerfilService.updatePerfilPasswordFormData(this.perfil.username, this.editPerfil);
    this.subscriptions.push(
      this.loginPerfilService.updatePerfilPassword(formData).subscribe(
        (response: Perfil) => {
          alert(`Dados atualizados`);
        },
        (errorResponse: HttpErrorResponse) => {
          alert(`Ocorreu um erro ao atualizar os dados`);
        }
      )
      );
  }
}
