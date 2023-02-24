import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'src/auth.service';
import { LoginperfilService } from '../../services/loginperfil.service';
import { Perfil } from '../model/perfil';

@Component({
  selector: 'app-menu',
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.css']
})
export class MenuComponent implements OnInit {
  public perfis : Perfil [] = [];
  constructor(private loginService: LoginperfilService,private authService: AuthService,private router:Router) { }

  ngOnInit(): void {
  }
  minhaImagem = "./assets/estadio .jpg";
  perfil = this.loginService.getPerfilFromLocalCache();

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
    this.loginService.logOut();
  }
}
