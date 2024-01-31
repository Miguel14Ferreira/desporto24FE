import { HttpErrorResponse } from '@angular/common/http';
import { Component } from '@angular/core';
import { BehaviorSubject, Subscription } from 'rxjs';
import { NotificationType } from 'src/app/enum/notification-type.enum';
import { LoginperfilService } from 'src/app/services/loginperfil.service';
import { NotificationService } from 'src/app/services/notification.service';
import { Perfil } from '../model/perfil';
import { AuthenticationService } from 'src/app/services/authethication.service';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';


@Component({
  selector: 'app-perfis',
  templateUrl: './perfis.component.html',
  styleUrls: ['./perfis.component.css']
})
export class PerfisComponent {
  private titleSubject = new BehaviorSubject<String>('Perfis');
  public titleAction$ = this.titleSubject.asObservable();
  public perfis: Perfil[] = [];
  perfil!: Perfil;
  showLoading!:boolean;
  locked!:boolean;
  subscriptions: Subscription[] = [];
  selectedPerfil!: Perfil;
  show!:boolean;
  response!: any;
  buttonId!: any;
  dark!:boolean;
  addFriend!:boolean;
  username!:any;
  private readonly USERNAME:string = 'username';
  showTable!:boolean;

  constructor (private router:Router,private loginPerfilService: LoginperfilService,private activatedRoute:ActivatedRoute, private authenticationService:AuthenticationService){}

  ngOnInit(): void{
    var theme = localStorage.getItem('theme');
    if (theme == 'claro'){
      this.dark = false
    } else {
      this.dark = true
    }
    this.authenticationService.isLoggedIn2()
    this.loginPerfilService.obterUserPeloUsername1(this.authenticationService.loggedInPerfilname).subscribe( data => {
      this.perfil = data;
    }, error => console.log());
  }

  fecharPerfil(){
    this.show = false;
  }

  AddFriend(){
    this.addFriend = true;
  }
  NaoAdd(){
    this.addFriend = false;
  }
  SendFriendRequest(){
    const formData = this.loginPerfilService.addFriendFromData(this.perfil.username,this.selectedPerfil.username);
    this.showLoading = true;
    this.subscriptions.push(
      this.loginPerfilService.addFriend(formData).subscribe(
        (response: Perfil) => {
          this.showLoading = false;
          alert(`Foi enviado um novo pedido de amizade a este utilizador!`);
        },
        (errorResponse: HttpErrorResponse) => {
          alert(`Ocorreu um erro a executar a operação`);
          this.showLoading = false;
        }
      )
    )
  }

  obterPerfis(searchTerm: string): void{
    if (searchTerm == ""){
      alert("Terás de preencher o campo de pesquisa para pesquisar.")
    } else  {
    this.showLoading = true;
    this.subscriptions.push(
      this.loginPerfilService.obterPerfis(searchTerm).subscribe(
        (response: Perfil[]) => {
          this.showTable = true;
          this.showLoading = false;
          this.perfis = response;
          alert(`Foram encontrados ${response.length} utilizadores`);
        },
        (errorResponse: HttpErrorResponse) => {
          alert(`Ocorreu um erro a executar a operação`);
          this.showLoading = false;
        }
      )
    )
      }
    }
      
  Menu(){
    this.router.navigate([`menu/${this.username}`]);
  }


  onSelectPerfil(selectedPerfil: Perfil):void{
    this.selectedPerfil = selectedPerfil;
    this.show = true;
  }
  
  procurarPerfis(searchTerm: string): void{
    /*
    const results: Perfil[] = [];
    for (const perfil of this.loginPerfilService.obterPerfis()) {
      if (perfil.username.toLowerCase().indexOf(searchTerm.toLowerCase()) !== -1 ||
          perfil.fullName.toLowerCase().indexOf(searchTerm.toLowerCase()) !== -1){
      results.push(perfil);
      }
    }
    this.perfis = results;
    if(results.length === 0 || !searchTerm){
      this.perfis = this.loginPerfilService.getPerfisFromLocalCache();
    }
    */
  }
}
