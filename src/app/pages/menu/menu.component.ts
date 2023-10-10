import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { AuthenticationService } from 'src/app/services/authethication.service';
import { Perfil } from '../model/perfil';
import { HttpErrorResponse } from '@angular/common/http';
import { LoginperfilService } from 'src/app/services/loginperfil.service';
import { Subscription } from 'rxjs';
import { Session } from '../session';

@Component({
  selector: 'app-menu',
  templateUrl: './menu.component.html',
  styleUrls: ['./menu.component.css']
})
export class MenuComponent implements OnInit {
  public sessoes : Session [] = [];
  fileName!: string;
  profileImage!: File;
  url:any;
  changetype:boolean = true;
  visible:boolean = true;
  username!: any;
  password!: string;
  showLoading!: boolean;
  showImage!: boolean;
  token: any;
  subscriptions: Subscription[] = [];
  id!:number;
  perfil!:Perfil;
  editPerfil:Perfil = new Perfil();
  refreshing!:boolean;
  locked!:boolean;
  selectedSessao!: Session;
  show!:boolean;
  response!: any;
  buttonId!: any;
  sessao!: Session;
  showMenu!: boolean;
  logOut!:boolean;
  dark!:boolean;
  private readonly USERNAME:string = 'username';

  constructor(private authenticationService:AuthenticationService,private router:Router,private loginPerfilService: LoginperfilService, private activatedRoute:ActivatedRoute) { }


  ngOnInit(): void {
    this.showImage = true;
    this.showMenu = false;
    this.logOut = false;
    this.activatedRoute.paramMap.subscribe(
      (params: ParamMap) => {
        this.username = params.get(this.USERNAME);
      }
      )
    /*if (this.selectedSessao.private == "true"){
      this.locked = true;
    } else {
      this.locked = false;
    }
    */
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

  NomeUtilizador(){
    return this.perfil.username;
  }
 
  alterarDados(){
    this.router.navigate([`menu/${this.username}/alterardados`]);
  }
  alterarPassword(){
    this.router.navigate([`menu/${this.username}/alterarPassword`]);
  }
  Utilizadores(){
    this.router.navigate([`menu/${this.username}/perfis`]);
  }
  verDadosPerfil(){
    this.router.navigate([`menu/${this.username}/dadosPerfil`]);
  }
  CriarSessao(){
    this.router.navigate([`menu/${this.username}/createEvent`]);
  }
  remover(){
    this.authenticationService.logOut();
        this.router.navigate(['login']);
}    
terminarSessao(){
  this.logOut = true;
}
fecharSessao(){
  this.show = false;
}
voltar(){
  this.logOut = false;
}

obterSessoes(showNotification: boolean): void{
  this.refreshing = true;
  this.subscriptions.push(
    this.loginPerfilService.obterSessoes().subscribe(
      (response: Session[]) => {
        this.refreshing = false;
        this.loginPerfilService.obterSessoes();
        this.sessoes = response;
        alert(`Foram encontrados ${response.length} sessões`);
      },
      (errorResponse: HttpErrorResponse) => {
        alert(`Ocorreu um erro a executar a operação`);
        this.refreshing = false;
      }
    )
  )
}

procurarSessoes(searchTerm: string): void{
  /*
  const results: Session[] = [];
  for (const sessao of this.loginPerfilService.getSessoesFromLocalCache()) {
    if (sessao.desporto.toLowerCase().indexOf(searchTerm.toLowerCase()) !== -1 ||
        sessao.utilizador.toLowerCase().indexOf(searchTerm.toLowerCase()) !== -1){
    results.push(sessao);
    }
  }
  this.sessoes = results;
  if(results.length === 0 || !searchTerm){
    this.sessoes = this.loginPerfilService.getSessoesFromLocalCache();
  }
  */
}

onSelectSessao(selectedSessao: Session):void{
  this.selectedSessao = selectedSessao;
  this.show = true;
}
MostrarMenu(){
  this.showMenu = true;
}
NaoMostrarMenu(){
  this.showMenu = false;
}
}
