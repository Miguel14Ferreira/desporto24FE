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
  showLoading2!: boolean;
  token: any;
  subscriptions: Subscription[] = [];
  id!:number;
  perfil!:Perfil;
  editperfil:Perfil = new Perfil();
  fileName!: any;
  dark!:boolean;
  private readonly USERNAME:string = "username";
  
  constructor(private loginPerfilService: LoginperfilService,private router:Router, private formBuilder: FormBuilder,private route:ActivatedRoute,private activatedRoute:ActivatedRoute,private authenticationService:AuthenticationService,private authService:AuthService) { }

  ngOnInit(): void {
    this.authenticationService.isLoggedIn2()
    this.loginPerfilService.obterUserPeloUsername1(this.authenticationService.loggedInPerfilname).subscribe( data => {
      this.perfil = data;
    }, error => console.log());
    var theme = localStorage.getItem('theme');
    if (theme == 'claro'){
      this.dark = false
    } else {
      this.dark = true
    }
  }
  Menu(){
    this.router.navigate([`menu`]);
  }

  viewPass(){
    this.visible = !this.visible;
    this.changetype = !this.changetype;
}
  

  
  onUpdatePerfilPassword(): void {
    if (this.editperfil.newUsername == "" || this.editperfil.password == "" || this.editperfil.confirmPassword == ""){
      alert(`Ainda tens espaços brancos para preencher!`)
    } else if (this.editperfil.password != this.editperfil.confirmPassword){
      alert(`As tuas palavras-passes são diferentes!`)
    } else {
      this.showLoading = true;
    const formData = this.loginPerfilService.updatePerfilPasswordFormData(this.username, this.editperfil);
    console.log(formData.get('newUsername'))
    this.subscriptions.push(
      this.loginPerfilService.updatePerfilPassword(formData).subscribe(
        (response: Perfil) => {
          this.showLoading = false;
          alert(`Dados atualizados`);
        },
        (errorResponse: HttpErrorResponse) => {
          this.showLoading = false;
          alert(`Ocorreu um erro ao atualizar os dados`);
        }
      )
      );
  }
}
}
