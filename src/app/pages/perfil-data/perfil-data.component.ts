import { Component } from '@angular/core';
import { ActivatedRoute, ParamMap } from '@angular/router';
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
  private readonly USERNAME : string = "username";
  perfil!:Perfil;
  constructor(private activatedRoute:ActivatedRoute, private loginPerfilService:LoginperfilService) { }

  ngOnInit(): void {
    this.activatedRoute.paramMap.subscribe(
      (params: ParamMap) => {
        this.username = params.get(this.USERNAME);
      }
      )
    this.loginPerfilService.obterUserPeloUsername1(this.username).subscribe( data => {
      this.perfil = data;
    }, error => console.log());
    /*if (this.selectedSessao.private == "true"){
      this.locked = true;
    } else {
      this.locked = false;
    }
    */
    var theme = localStorage.getItem('theme');
    if (theme == 'claro'){
      this.dark = false
    } else {
      this.dark = true
    }
  }

}
