import { Component } from '@angular/core';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { Perfil } from '../model/perfil';
import { LoginperfilService } from 'src/app/services/loginperfil.service';
import { AuthenticationService } from 'src/app/services/authethication.service';

@Component({
  selector: 'app-perfil-data',
  templateUrl: './perfil-data.component.html',
  styleUrls: ['./perfil-data.component.css']
})
export class PerfilDataComponent {
  dark!:boolean;
  username!:any;
  locked!:boolean;
  mfa!:boolean;
  private readonly USERNAME : string = "username";
  perfil!:Perfil;
  constructor(private authenticationService:AuthenticationService, private loginPerfilService:LoginperfilService, private router:Router) { }

  ngOnInit(): void {
    this.loginPerfilService.obterUserPeloUsername1(this.authenticationService.loggedInPerfilname).subscribe( data => {
      this.perfil = data;
    }, error => console.log());
    var theme = localStorage.getItem('theme');
    if (theme == 'claro'){
      this.dark = false
    } else {
      this.dark = true
    }
    if (this.perfil.notLocked == true){
      this.locked = false;
    } else {
      this.locked = true;
    }
    if (this.perfil.mfa == false){
      this.mfa = false;
    } else {
      this.mfa = true;
    }
  }
  alterarDados(){
    this.router.navigate([`menu/alterardados`]);
  }
  Menu(){
    this.router.navigate([`menu`]);
  }
}
