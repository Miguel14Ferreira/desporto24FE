import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { FormBuilder } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
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
  username!: any;
  password!: string;
  showLoading!: boolean;
  token: any;
  subscriptions: Subscription[] = [];
  id!:number;
  perfil!:Perfil;
  public editPerfil = new Perfil();
  fileName!: any;
  dark!:boolean;
  private readonly USERNAME:string = "username";
  
  constructor(private loginPerfilService: LoginperfilService,private router:Router, private formBuilder: FormBuilder,private route:ActivatedRoute,private activatedRoute:ActivatedRoute,private authenticationService:AuthenticationService,private authService:AuthService) { }

  ngOnInit(): void {
    this.activatedRoute.paramMap.subscribe(
      (params: ParamMap) => {
        this.username = params.get(this.USERNAME);
      }
      )
    this.loginPerfilService.obterUserPeloUsername1(this.username).subscribe( data => {
      this.perfil = data;
    }, error => console.log());
    var theme = localStorage.getItem('theme');
    if (theme == 'claro'){
      this.dark = false
    } else {
      this.dark = true
    }
  }
  minhaImagem = "./assets/ski .jpg";

  palavrasPassesDiferentes(novaPassword : string, novaConfirmPassword: string, password: string){
    if (novaPassword != novaConfirmPassword){
      alert( `A nova palavra-passe e a confirmação da nova palavra-passe tem de estar iguais!`);
    } else if (password == novaPassword){
      alert(`A presente palavra-passe que estás a colocar, já se encontra em uso.`)
    }
  }
  Menu(){
    this.router.navigate([`menu/${this.username}`]);
  }

  viewPass(){
    this.visible = !this.visible;
    this.changetype = !this.changetype;
}
  
  obterNomeUtilizador (){
    return this.perfil.username;
  }
  
  onUpdatePerfilPassword(): void {
    if (this.editPerfil.username == "" || this.editPerfil.password == "" || this.editPerfil.confirmPassword == ""){
      alert(`Ainda tens espaços brancos para preencher!`)
    } else if (this.editPerfil.password != this.editPerfil.confirmPassword){
      alert(`As tuas palavras-passes são diferentes!`)
    } else {
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
}
