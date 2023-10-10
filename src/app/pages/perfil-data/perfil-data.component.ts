import { Component } from '@angular/core';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { Perfil } from '../model/perfil';
import { LoginperfilService } from 'src/app/services/loginperfil.service';

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
  constructor(private activatedRoute:ActivatedRoute, private loginPerfilService:LoginperfilService, private router:Router) { }

  ngOnInit(): void {
    this.activatedRoute.paramMap.subscribe(
      (params: ParamMap) => {
        this.username = params.get(this.USERNAME);
      }
      )
    this.loginPerfilService.obterUserPeloUsername1(this.username).subscribe( data => {
      this.perfil = data;
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
    }, error => console.log(error));
    var theme = localStorage.getItem('theme');
    if (theme == 'claro'){
      this.dark = false
    } else {
      this.dark = true
    }
  }
  alterarDados(){
    this.router.navigate([`menu/${this.username}/alterardados`]);
  }
}
