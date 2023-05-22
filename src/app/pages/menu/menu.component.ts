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
  perfil = this.authenticationService.getPerfilFromLocalCache();

  NomeUtilizador(){
    return this.perfil.username;
  }
 
  alterarDados(){
    this.router.navigate(['menu/alterardados']);
  }
  alterarPassword(){
    this.router.navigate(['menu/alterarPassword']);
  }
  remover(){
    this.authenticationService.logOut();
  }
}
