import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthenticationService } from 'src/app/services/authethication.service';
import { Perfil } from '../model/perfil';

@Component({
  selector: 'app-menu',
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.css']
})
export class MenuComponent implements OnInit {
  public perfis : Perfil [] = [];
  constructor(private authenticationService:AuthenticationService,private router:Router) { }

  ngOnInit(): void {
  }
  minhaImagem = "./assets/estadio .jpg";
  perfil = this.authenticationService.getPerfilFromLocalCache();

  NomeUtilizador(){
    this.perfil.username;
  }
 
  alterarDados(){
    this.router.navigate(['menu/alterardados/username',this.perfil.username]);
  }
  alterarPassword(){
    this.router.navigate(['menu/alterarPassword', this.perfil.username]);
  }
  remover(){
    this.authenticationService.logOut();
  }
}
